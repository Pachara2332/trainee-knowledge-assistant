"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatConversation, Message } from "../../components/chat/types";

const starterMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "**Console online.** Ask me anything, or attach a TXT/PDF so I can answer with document context and citations.",
  },
];

const HISTORY_KEY_PREFIX = "knowledge-assistant.chat-conversations";

type ConversationState = {
  activeConversationId: string;
  conversations: ChatConversation[];
};

export function getChatHistoryKey(email?: string | null) {
  const accountKey = email?.trim().toLowerCase() || "anonymous";
  return `${HISTORY_KEY_PREFIX}.${encodeURIComponent(accountKey)}`;
}

function createConversation(): ChatConversation {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: starterMessages,
    updatedAt: Date.now(),
  };
}

function createInitialConversation(): ChatConversation {
  return {
    id: "initial-chat",
    title: "New Chat",
    messages: starterMessages,
    updatedAt: 0,
  };
}

function getConversationTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const title = firstUserMessage?.content.trim() || "New Chat";
  return title.length > 36 ? `${title.slice(0, 33)}...` : title;
}

function createFallbackState(): ConversationState {
  const conversation = createInitialConversation();

  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

function loadConversationState(historyKey: string): ConversationState {
  const fallbackState = createFallbackState();

  if (typeof window === "undefined") {
    return fallbackState;
  }

  const saved = window.localStorage.getItem(historyKey);

  if (!saved) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(saved) as ConversationState;
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations.filter(
          (conversation) =>
            conversation &&
            typeof conversation.id === "string" &&
            Array.isArray(conversation.messages),
        )
      : [];

    if (conversations.length === 0) {
      return fallbackState;
    }

    return {
      activeConversationId:
        conversations.find((conversation) => conversation.id === parsed.activeConversationId)
          ?.id ?? conversations[0].id,
      conversations,
    };
  } catch {
    window.localStorage.removeItem(historyKey);
    return fallbackState;
  }
}

export function useChatConversations(email?: string | null) {
  const historyKey = useMemo(() => getChatHistoryKey(email), [email]);
  const [conversationState, setConversationState] =
    useState<ConversationState>(createFallbackState);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setConversationState(loadConversationState(historyKey));
      setLoadedHistoryKey(historyKey);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [historyKey]);

  useEffect(() => {
    if (loadedHistoryKey !== historyKey) {
      return;
    }

    window.localStorage.setItem(
      historyKey,
      JSON.stringify({
        ...conversationState,
        conversations: conversationState.conversations.slice(0, 20),
      }),
    );
  }, [conversationState, historyKey, loadedHistoryKey]);

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
    const conversation = createConversation();

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

  function deleteConversation(conversationId: string) {
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
    selectConversation,
    updateConversationMessages,
    updateDraftTitle,
  };
}
