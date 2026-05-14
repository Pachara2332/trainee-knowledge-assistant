"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { toClientAttachment } from "../../components/chat/file-attachment";
import { MessageList } from "../../components/chat/message-list";
import { TokenUsageBadge } from "../../components/chat/token-usage-badge";
import type { ClientAttachment, Message, TokenUsage } from "../../components/chat/types";

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

const starterMessages: Message[] = [
  {
    id: "upload-welcome",
    role: "assistant",
    content: "**Document console ready.** Upload a PDF/TXT, then ask about it.",
  },
];

export function UploadClient({ email }: { email?: string | null }) {
  const [documentAttachment, setDocumentAttachment] =
    useState<ClientAttachment | null>(null);
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalTokens = useMemo(
    () =>
      messages.reduce(
        (total, message) => total + (message.usage?.totalTokens ?? 0),
        0,
      ),
    [messages],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setDocumentAttachment(null);
      return;
    }

    try {
      const attachment = await toClientAttachment(file);
      setDocumentAttachment(attachment);
      setMessages([
        ...starterMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Loaded **${attachment.name}**. Ask a question about this document.`,
        },
      ]);
      setQuestion("");
      setError("");
    } catch (error) {
      setDocumentAttachment(null);
      setError(error instanceof Error ? error.message : "Unable to upload file.");
      event.target.value = "";
    }
  }

  function clearDocument() {
    setDocumentAttachment(null);
    setMessages(starterMessages);
    setQuestion("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      isStreaming ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = question.trim();

    if (!text || isStreaming) {
      return;
    }

    if (!documentAttachment) {
      setError("Upload a PDF or TXT file first.");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachmentName: documentAttachment.name,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    const requestMessages = [...messages, userMessage]
      .filter((message) => message.id !== "upload-welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    setError("");
    setIsStreaming(true);

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
          attachment: documentAttachment,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to ask about this document.");
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
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + data.text }
                  : message,
              ),
            );
          }

          if (event.name === "usage") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, usage: data as TokenUsage }
                  : message,
              ),
            );
          }

          if (event.name === "provider") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, provider: String(data.provider ?? "AI") }
                  : message,
              ),
            );
          }

          if (event.name === "error") {
            throw new Error(data.message ?? "Unable to answer from document.");
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

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden border-4 border-[#1C1B1A] bg-[#E7E1D6] text-[#1C1B1A] shadow-[18px_18px_0_#1C1B1A]">
      <div className="grid gap-3 border-b-4 border-[#1C1B1A] bg-[#1C1B1A] px-4 py-3 text-sm text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="font-black uppercase tracking-wider text-[#E7E1D6]">
          Upload operator: <span className="text-[#C89B3C]">{email}</span>
        </div>
        <TokenUsageBadge totalTokens={totalTokens} />
      </div>

      <div className="grid gap-3 border-b-4 border-[#1C1B1A] bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={handleFileChange}
        />

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8E3A3A]">
            Document
          </p>
          <p className="mt-1 truncate text-sm font-black">
            {documentAttachment
              ? `${documentAttachment.name} (${documentAttachment.mimeType})`
              : "No file loaded"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="comic-impact border-2 border-[#1C1B1A] bg-[#C89B3C] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1C1B1A] shadow-[4px_4px_0_#1C1B1A]"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload PDF/TXT
          </button>
          {documentAttachment ? (
            <button
              className="comic-impact border-2 border-[#1C1B1A] bg-[#8E3A3A] px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[4px_4px_0_#1C1B1A]"
              type="button"
              onClick={clearDocument}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <MessageList messages={messages} />

      {error ? (
        <div className="border-t-4 border-[#1C1B1A] bg-[#8E3A3A] px-4 py-3 text-sm font-black uppercase tracking-wider text-white">
          {error}
        </div>
      ) : null}

      <form className="border-t-4 border-[#1C1B1A] bg-white p-4" onSubmit={handleAsk}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <textarea
            className="min-h-14 resize-none border-4 border-[#1C1B1A] bg-[#E7E1D6] px-3 py-3 text-sm font-semibold text-[#1C1B1A] outline-none transition focus:bg-white focus:shadow-[6px_6px_0_#4F6F86]"
            value={question}
            rows={2}
            placeholder="Ask about the uploaded document..."
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleQuestionKeyDown}
          />

          {isStreaming ? (
            <button
              className="comic-impact min-h-14 border-4 border-[#1C1B1A] bg-[#8E3A3A] px-6 text-sm font-black uppercase tracking-wider text-white shadow-[7px_7px_0_#1C1B1A]"
              type="button"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </button>
          ) : (
            <button
              className="comic-impact min-h-14 border-4 border-[#1C1B1A] bg-[#C89B3C] px-8 text-sm font-black uppercase tracking-wider text-[#1C1B1A] shadow-[7px_7px_0_#1C1B1A] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!question.trim() || !documentAttachment}
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
