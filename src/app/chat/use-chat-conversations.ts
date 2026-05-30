"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChatConversation,
  Message,
  TokenUsage,
} from "../../components/chat/types";

const starterMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "**Ready when you are.** Ask anything from your trainee knowledge base, or attach a TXT/PDF for document context.",
  },
];

const LEGACY_HISTORY_KEY_PREFIX = "knowledge-assistant.chat-conversations";
const LOCAL_CONVERSATION_PREFIX = "local-chat";

type ApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  tokenUsage: TokenUsage | null;
  attachments: Array<{ name?: string }> | null;
  createdAt: string;
};

type ApiConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ApiMessage[];
};

type ConversationState = {
  activeConversationId: string;
  conversations: ChatConversation[];
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getChatHistoryKey(email?: string | null) {
  const accountKey = email?.trim().toLowerCase() || "anonymous";
  return `${LEGACY_HISTORY_KEY_PREFIX}.${encodeURIComponent(accountKey)}`;
}

function createLocalConversation(): ChatConversation {
  return {
    id: `${LOCAL_CONVERSATION_PREFIX}-${crypto.randomUUID()}`,
    title: "New Chat",
    messages: starterMessages,
    updatedAt: Date.now(),
  };
}

function createFallbackState(): ConversationState {
  const conversation = createLocalConversation();

  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

function getConversationTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const title = firstUserMessage?.content.trim() || "New Chat";
  return title.length > 36 ? `${title.slice(0, 33)}...` : title;
}

function toClientMessage(message: ApiMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    provider: message.provider ?? undefined,
    usage: message.tokenUsage ?? undefined,
    attachmentName: message.attachments?.[0]?.name,
  };
}

function toClientConversation(conversation: ApiConversation): ChatConversation {
  const messages = conversation.messages.map(toClientMessage);

  return {
    id: conversation.id,
    title: conversation.title,
    messages: messages.length > 0 ? messages : starterMessages,
    updatedAt: new Date(conversation.updatedAt).getTime(),
  };
}

function isLocalConversationId(conversationId: string) {
  return conversationId.startsWith(`${LOCAL_CONVERSATION_PREFIX}-`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiRequestError(
      body?.error ?? "Unable to sync chat history.",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function useChatConversations(workspaceId: string | null) {
  const [conversationState, setConversationState] =
    useState<ConversationState>(createFallbackState);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      setIsHistoryLoading(true);
      setHistoryError("");

      try {
        const data = await requestJson<{ conversations: ApiConversation[] }>(
          workspaceId
            ? `/api/conversations?workspaceId=${encodeURIComponent(workspaceId)}`
            : "/api/conversations",
        );

        if (cancelled) {
          return;
        }

        const conversations = data.conversations.map(toClientConversation);

        if (conversations.length === 0) {
          setConversationState(createFallbackState());
          return;
        }

        setConversationState({
          activeConversationId: conversations[0].id,
          conversations,
        });
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiRequestError && error.status === 401) {
            setConversationState(createFallbackState());
          } else {
            setHistoryError(
              error instanceof Error ? error.message : "Unable to load chat history.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const activeConversation =
    conversationState.conversations.find(
      (conversation) => conversation.id === conversationState.activeConversationId,
    ) ?? conversationState.conversations[0];
  const messages = activeConversation?.messages ?? starterMessages;
  const totalTokens = useMemo(
    () =>
      messages.reduce(
        (total, message) => total + (message.usage?.totalTokens ?? 0),
        0,
      ),
    [messages],
  );

  function replaceConversationId(localId: string, persisted: ChatConversation) {
    setConversationState((current) => ({
      activeConversationId:
        current.activeConversationId === localId
          ? persisted.id
          : current.activeConversationId,
      conversations: current.conversations.map((conversation) =>
        conversation.id === localId
          ? {
              ...conversation,
              id: persisted.id,
              title: persisted.title,
              updatedAt: persisted.updatedAt,
            }
          : conversation,
      ),
    }));
  }

  async function ensureConversationPersisted(conversationId: string, title: string) {
    if (!isLocalConversationId(conversationId)) {
      return conversationId;
    }

    try {
      const data = await requestJson<{ conversation: ApiConversation }>(
        "/api/conversations",
        {
          method: "POST",
          body: JSON.stringify({ title, workspaceId }),
        },
      );
      const persisted = toClientConversation(data.conversation);
      replaceConversationId(conversationId, persisted);
      return persisted.id;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        return conversationId;
      }

      throw error;
    }
  }

  function updateConversationMessages(
    conversationId: string,
    updater: (messages: Message[]) => Message[],
  ) {
    setConversationState((current) => ({
      ...current,
      conversations: current.conversations
        .map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          const nextMessages = updater(conversation.messages);

          return {
            ...conversation,
            title: getConversationTitle(nextMessages),
            messages: nextMessages.slice(-40),
            updatedAt: Date.now(),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }));
  }

  function createNewConversation() {
    const conversation = createLocalConversation();

    setConversationState((current) => ({
      activeConversationId: conversation.id,
      conversations: [conversation, ...current.conversations].slice(0, 20),
    }));
  }

  function selectConversation(conversationId: string) {
    setConversationState((current) => ({
      ...current,
      activeConversationId: conversationId,
    }));
  }

  async function deleteConversationInWorkspace(conversationId: string) {
    if (isLocalConversationId(conversationId)) {
      return;
    }

    await requestJson(
      workspaceId
        ? `/api/conversations/${conversationId}?workspaceId=${encodeURIComponent(workspaceId)}`
        : `/api/conversations/${conversationId}`,
      {
        method: "DELETE",
      },
    );
  }

  async function deleteConversation(conversationId: string) {
    setConversationState((current) => {
      const remaining = current.conversations.filter(
        (conversation) => conversation.id !== conversationId,
      );

      if (remaining.length === 0) {
        return createFallbackState();
      }

      return {
        activeConversationId:
          current.activeConversationId === conversationId
            ? remaining[0].id
            : current.activeConversationId,
        conversations: remaining,
      };
    });

    if (!isLocalConversationId(conversationId)) {
      await deleteConversationInWorkspace(conversationId);
    }
  }

  function updateDraftTitle(value: string) {
    const draftTitle = value.trim();

    setConversationState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => {
        if (
          conversation.id !== current.activeConversationId ||
          conversation.messages.some((message) => message.role === "user")
        ) {
          return conversation;
        }

        return {
          ...conversation,
          title: draftTitle
            ? draftTitle.length > 36
              ? `${draftTitle.slice(0, 33)}...`
              : draftTitle
            : "New Chat",
        };
      }),
    }));
  }

  return {
    activeConversation,
    conversations: conversationState.conversations,
    messages,
    totalTokens,
    createNewConversation,
    deleteConversation,
    ensureConversationPersisted,
    historyError,
    isHistoryLoading,
    selectConversation,
    updateConversationMessages,
    updateDraftTitle,
  };
}
