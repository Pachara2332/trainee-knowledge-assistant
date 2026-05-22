"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { ChatComposer } from "../../components/chat/chat-composer";
import { ChatHistoryPanel } from "../../components/chat/chat-history-panel";
import { toClientAttachment } from "../../components/chat/file-attachment";
import { MessageList } from "../../components/chat/message-list";
import { TokenUsageBadge } from "../../components/chat/token-usage-badge";
import type { ClientAttachment, Message, TokenUsage } from "../../components/chat/types";
import { parseSseEvents } from "./sse-events";
import { useChatConversations } from "./use-chat-conversations";

export function ChatClient({ email }: { email?: string | null }) {
  const {
    activeConversation,
    conversations,
    messages,
    totalTokens,
    createNewConversation,
    deleteConversation,
    selectConversation,
    updateConversationMessages,
    updateDraftTitle,
  } = useChatConversations(email);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [attachedFile, setAttachedFile] = useState<ClientAttachment | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetComposer() {
    setInput("");
    setError("");
    setAttachedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleNewChat() {
    createNewConversation();
    resetComposer();
  }

  function handleSelectConversation(conversationId: string) {
    selectConversation(conversationId);
    resetComposer();
  }

  function handleDeleteConversation(conversationId: string) {
    deleteConversation(conversationId);
    resetComposer();
  }

  function handleInputChange(value: string) {
    setInput(value);
    updateDraftTitle(value);
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
        conversations={conversations}
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
