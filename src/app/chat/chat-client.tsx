"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "../../components/chat/chat-composer";
import { ChatHistoryPanel } from "../../components/chat/chat-history-panel";
import { toClientAttachment } from "../../components/chat/file-attachment";
import { MessageList } from "../../components/chat/message-list";
import { TokenUsageBadge } from "../../components/chat/token-usage-badge";
import type {
  ChatConversation,
  ClientAttachment,
  Message,
  TokenUsage,
} from "../../components/chat/types";

const starterMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "**Console online.** Ask me anything, or attach a TXT/PDF so I can answer with document context and citations.",
  },
];
const HISTORY_KEY = "knowledge-assistant.chat-conversations";

type ConversationState = {
  activeConversationId: string;
  conversations: ChatConversation[];
};

function parseSseEvents(buffer: string) {
  const events = buffer.split("\n\n");
  const rest = events.pop() ?? "";

  return {
    events: events.map((event) => {
      const name =
        event
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim() ?? "message";
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

      return { name, data };
    }),
    rest,
  };
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

function loadConversationState(): ConversationState {
  const fallbackConversation = createInitialConversation();

  if (typeof window === "undefined") {
    return {
      activeConversationId: fallbackConversation.id,
      conversations: [fallbackConversation],
    };
  }

  const saved = window.localStorage.getItem(HISTORY_KEY);

  if (!saved) {
    return {
      activeConversationId: fallbackConversation.id,
      conversations: [fallbackConversation],
    };
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
      return {
        activeConversationId: fallbackConversation.id,
        conversations: [fallbackConversation],
      };
    }

    return {
      activeConversationId:
        conversations.find((conversation) => conversation.id === parsed.activeConversationId)
          ?.id ?? conversations[0].id,
      conversations,
    };
  } catch {
    window.localStorage.removeItem(HISTORY_KEY);
    return {
      activeConversationId: fallbackConversation.id,
      conversations: [fallbackConversation],
    };
  }
}

export function ChatClient({ email }: { email?: string | null }) {
  const [conversationState, setConversationState] = useState<ConversationState>(() => {
    const conversation = createInitialConversation();

    return {
      activeConversationId: conversation.id,
      conversations: [conversation],
    };
  });
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [attachedFile, setAttachedFile] = useState<ClientAttachment | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setConversationState(loadConversationState());
      setHasLoadedHistory(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        ...conversationState,
        conversations: conversationState.conversations.slice(0, 20),
      }),
    );
  }, [conversationState, hasLoadedHistory]);

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

  function handleNewChat() {
    const conversation = createConversation();

    setConversationState((current) => ({
      activeConversationId: conversation.id,
      conversations: [conversation, ...current.conversations].slice(0, 20),
    }));
    setInput("");
    setError("");
    setAttachedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSelectConversation(conversationId: string) {
    setConversationState((current) => ({
      ...current,
      activeConversationId: conversationId,
    }));
    setError("");
    setAttachedFile(null);
    setInput("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDeleteConversation(conversationId: string) {
    setConversationState((current) => {
      const remaining = current.conversations.filter(
        (conversation) => conversation.id !== conversationId,
      );

      if (remaining.length === 0) {
        const conversation = createInitialConversation();

        return {
          activeConversationId: conversation.id,
          conversations: [conversation],
        };
      }

      return {
        activeConversationId:
          current.activeConversationId === conversationId
            ? remaining[0].id
            : current.activeConversationId,
        conversations: remaining,
      };
    });
    setInput("");
    setError("");
    setAttachedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleInputChange(value: string) {
    setInput(value);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isStreaming) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachmentName: attachedFile?.name,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    const conversationId = activeConversation.id;
    const requestMessages = [...messages, userMessage]
      .filter((message) => message.id !== "welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    updateConversationMessages(conversationId, (current) => [
      ...current,
      userMessage,
      assistantMessage,
    ]);
    setInput("");
    setError("");
    setAttachedFile(null);
    setIsStreaming(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
          attachment: attachedFile,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.rest;

        for (const event of parsed.events) {
          const data = event.data ? JSON.parse(event.data) : {};

          if (event.name === "token") {
            updateConversationMessages(conversationId, (current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + data.text }
                  : message,
              ),
            );
          }

          if (event.name === "usage") {
            updateConversationMessages(conversationId, (current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, usage: data as TokenUsage }
                  : message,
              ),
            );
          }

          if (event.name === "provider") {
            updateConversationMessages(conversationId, (current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, provider: String(data.provider ?? "AI") }
                  : message,
              ),
            );
          }

          if (event.name === "error") {
            throw new Error(data.message ?? "Unable to generate a response.");
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("Response stopped.");
      } else {
        setError(error instanceof Error ? error.message : "Something went wrong.");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setAttachedFile(null);
      return;
    }

    try {
      setAttachedFile(await toClientAttachment(file));
      setError("");
    } catch (error) {
      setAttachedFile(null);
      setError(error instanceof Error ? error.message : "Unable to attach file.");
      event.target.value = "";
    }
  }

  function removeFile() {
    setAttachedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section className="chat-console relative flex h-full min-h-0 flex-1 flex-col overflow-hidden border-4 border-[#1C1B1A] bg-[#E7E1D6] text-[#1C1B1A] shadow-[18px_18px_0_#1C1B1A]">
      <div className="grid gap-3 border-b-4 border-[#1C1B1A] bg-[#1C1B1A] px-4 py-3 text-sm text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="font-black uppercase tracking-wider text-[#E7E1D6]">
          Operator: <span className="text-[#C89B3C]">{email}</span>
        </div>
        <TokenUsageBadge totalTokens={totalTokens} />
      </div>

      <ChatHistoryPanel
        conversations={conversationState.conversations}
        activeConversationId={activeConversation.id}
        isStreaming={isStreaming}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <MessageList messages={messages} />

      {error ? (
        <div className="border-t-4 border-[#1C1B1A] bg-[#8E3A3A] px-4 py-3 text-sm font-black uppercase tracking-wider text-white">
          {error}
        </div>
      ) : null}

      <ChatComposer
        input={input}
        attachedFile={attachedFile}
        isStreaming={isStreaming}
        fileInputRef={fileInputRef}
        onInputChange={handleInputChange}
        onFileChange={handleFileChange}
        onRemoveFile={removeFile}
        onSubmit={handleSubmit}
        onStop={() => abortRef.current?.abort()}
      />
    </section>
  );
}
