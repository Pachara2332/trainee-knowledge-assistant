"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "../../components/chat/chat-composer";
import { MessageList } from "../../components/chat/message-list";
import { TokenUsageBadge } from "../../components/chat/token-usage-badge";
import type {
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
const HISTORY_KEY = "knowledge-assistant.chat-history";

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

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]/g, "").trim().slice(0, 120);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function toClientAttachment(file: File): Promise<ClientAttachment> {
  const name = sanitizeFileName(file.name) || "attachment";
  const lowerName = file.name.toLowerCase();
  const isText = file.type === "text/plain" || lowerName.endsWith(".txt");
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

  if (!isText && !isPdf) {
    throw new Error("Only PDF or TXT files can be attached.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File must be 10MB or smaller.");
  }

  if (isText) {
    return {
      name,
      mimeType: "text/plain",
      text: (await file.text()).slice(0, 40_000),
    };
  }

  return {
    name,
    mimeType: "application/pdf",
    data: await readFileAsBase64(file),
  };
}

export function ChatClient({ email }: { email?: string | null }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") {
      return starterMessages;
    }

    const saved = window.localStorage.getItem(HISTORY_KEY);

    if (!saved) {
      return starterMessages;
    }

    try {
      const parsed = JSON.parse(saved) as Message[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : starterMessages;
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
      return starterMessages;
    }
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [attachedFile, setAttachedFile] = useState<ClientAttachment | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  const totalTokens = useMemo(
    () =>
      messages.reduce(
        (total, message) => total + (message.usage?.totalTokens ?? 0),
        0,
      ),
    [messages],
  );

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
    const requestMessages = [...messages, userMessage]
      .filter((message) => message.id !== "welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages([...messages, userMessage, assistantMessage]);
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
    <section className="chat-console relative flex min-h-[72vh] flex-1 flex-col overflow-hidden border-4 border-[#111111] bg-[#E5E7EB] text-[#111111] shadow-[18px_18px_0_#111111]">
      <div className="grid gap-3 border-b-4 border-[#111111] bg-[#111111] px-4 py-3 text-sm text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="font-black uppercase tracking-wider text-[#E5E7EB]">
          Operator: <span className="text-[#FBB829]">{email}</span>
        </div>
        <TokenUsageBadge totalTokens={totalTokens} />
      </div>

      <MessageList messages={messages} />

      {error ? (
        <div className="border-t-4 border-[#111111] bg-[#B91C1C] px-4 py-3 text-sm font-black uppercase tracking-wider text-white">
          {error}
        </div>
      ) : null}

      <ChatComposer
        input={input}
        attachedFile={attachedFile}
        isStreaming={isStreaming}
        fileInputRef={fileInputRef}
        onInputChange={setInput}
        onFileChange={handleFileChange}
        onRemoveFile={removeFile}
        onSubmit={handleSubmit}
        onStop={() => abortRef.current?.abort()}
      />
    </section>
  );
}
