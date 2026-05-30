"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownMessage } from "../../components/chat/markdown-message";
import { parseSseEvents } from "../chat/sse-events";

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentStep = {
  id: string;
  tool: string;
  title: string;
  status: "started" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
  error?: string;
  createdAt: string;
};

type Workspace = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

type AgentMemory = {
  id: string;
  key: string;
  value: string;
  source: "agent" | "user" | "system";
  updatedAt: string;
};

function displayName(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name.trim();
  }

  return email?.split("@")[0] || "Trainee";
}

function prettyJson(value: unknown) {
  if (value === undefined) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function stepTone(status: AgentStep["status"]) {
  if (status === "completed") {
    return "border-[#2f6f55] bg-[#102018] text-[#baf3d7]";
  }

  if (status === "failed") {
    return "border-[#704040] bg-[#241111] text-[#ffc4c4]";
  }

  return "border-[#675c38] bg-[#211d10] text-[#ffe7a3]";
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-sm font-semibold">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AgentClient({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const accountName = displayName(name, email);
  const latestAnswer = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "",
    [messages],
  );
  const visibleMemories = currentWorkspaceId ? memories : [];

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const response = await fetch("/api/workspaces");

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Unable to load workspaces.");
        }

        const data = (await response.json()) as { workspaces: Workspace[] };

        if (cancelled) {
          return;
        }

        setWorkspaces(data.workspaces);
        setCurrentWorkspaceId((current) => current ?? data.workspaces[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Unable to load workspaces.");
        }
      }
    }

    loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMemories(workspaceId: string) {
    setIsMemoryLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/memories`);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to load workspace memories.");
      }

      const data = (await response.json()) as { memories: AgentMemory[] };
      setMemories(data.memories);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load memories.");
    } finally {
      setIsMemoryLoading(false);
    }
  }

  useEffect(() => {
    if (!currentWorkspaceId) {
      return;
    }

    const timer = window.setTimeout(() => {
      loadMemories(currentWorkspaceId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentWorkspaceId]);

  async function deleteMemory(key: string) {
    if (!currentWorkspaceId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspaceId}/memories/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to delete memory.");
      }

      setMemories((current) => current.filter((memory) => memory.key !== key));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete memory.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isRunning) {
      return;
    }

    const nextMessages: AgentMessage[] = [...messages, { role: "user", content: text }];
    const controller = new AbortController();
    abortRef.current = controller;

    setInput("");
    setMessages(nextMessages);
    setSteps([]);
    setStatus("Thinking");
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          workspaceId: currentWorkspaceId,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to run agent.");
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

        for (const eventRow of parsed.events) {
          const data = eventRow.data ? JSON.parse(eventRow.data) : {};

          if (eventRow.name === "status") {
            setStatus(String(data.label ?? "Thinking"));
          }

          if (eventRow.name === "step") {
            const step = data as AgentStep;
            setStatus(step.status === "started" ? step.title : `${step.tool} ${step.status}`);
            setSteps((current) => [...current, step]);
          }

          if (eventRow.name === "final") {
            setMessages((current) => [
              ...current,
              { role: "assistant", content: String(data.answer ?? "") },
            ]);
            setStatus("Completed");
            if (currentWorkspaceId) {
              loadMemories(currentWorkspaceId);
            }
          }

          if (eventRow.name === "error") {
            throw new Error(data.message ?? "Unable to run agent.");
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Stopped");
        setError("Agent stopped.");
      } else {
        setStatus("Failed");
        setError(error instanceof Error ? error.message : "Something went wrong.");
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/chat"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm font-semibold"
            aria-label="Back to chat"
          >
            K
          </Link>
          <Avatar label={accountName} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Agent Workspace</h1>
            <p className="truncate text-xs text-muted">{accountName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="h-9 max-w-[220px] rounded-md border border-border bg-surface px-2 text-sm font-semibold text-foreground outline-none"
            value={currentWorkspaceId ?? ""}
            onChange={(event) => {
              setCurrentWorkspaceId(event.target.value || null);
              setMessages([]);
              setSteps([]);
              setStatus("Ready");
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <Link
            href="/chat"
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:text-foreground"
          >
            Chat
          </Link>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto grid w-full max-w-3xl gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Current Status
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isRunning ? "animate-pulse bg-[#d7b85c]" : "bg-[#5fbf8f]"
                    }`}
                  />
                  <p className="text-lg font-semibold">{status}</p>
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="grid min-h-[320px] place-items-center rounded-md border border-border bg-surface px-4 text-center">
                  <div className="max-w-lg">
                    <h2 className="text-3xl font-semibold tracking-tight">
                      Give the agent a goal.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Try a multi-step request such as searching workspace docs,
                      comparing fresh web context, creating a report, and sending a summary.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {messages.map((message, index) => (
                    <article
                      key={`${message.role}-${index}`}
                      className={`rounded-md border p-4 ${
                        message.role === "user"
                          ? "border-border bg-surface"
                          : "border-[#2f3d4c] bg-[#0d141b]"
                      }`}
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {message.role === "user" ? "Goal" : "Final Result"}
                      </p>
                      <MarkdownMessage content={message.content} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="mx-auto mb-3 w-[min(100%-2rem,768px)] rounded-md border border-[#704040] bg-[#241111] px-4 py-3 text-sm font-semibold text-[#ffc4c4]">
              {error}
            </div>
          ) : null}

          <form className="border-t border-border bg-background p-4" onSubmit={handleSubmit}>
            <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <textarea
                className="min-h-24 resize-none rounded-md border border-border bg-surface px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-muted"
                value={input}
                placeholder="Ask the agent to plan, search, act, and report..."
                disabled={isRunning}
                onChange={(event) => setInput(event.target.value)}
              />
              {isRunning ? (
                <button
                  className="h-12 rounded-md border border-[#704040] px-5 text-sm font-semibold text-[#ffc4c4] transition hover:bg-[#241111] sm:h-auto"
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                >
                  Stop
                </button>
              ) : (
                <button
                  className="h-12 rounded-md bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:h-auto"
                  disabled={!input.trim()}
                >
                  Run
                </button>
              )}
            </div>
          </form>
        </main>

        <aside className="hidden min-h-0 border-l border-border bg-surface lg:flex lg:flex-col">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-semibold">Workspace memory</p>
            <p className="mt-1 text-xs text-muted">
              {isMemoryLoading ? "Loading..." : `${visibleMemories.length} saved memories`}
            </p>
          </div>
          <div className="max-h-[38vh] overflow-y-auto border-b border-border p-4">
            {visibleMemories.length ? (
              <div className="grid gap-3">
                {visibleMemories.map((memory) => (
                  <article
                    key={memory.id}
                    className="rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{memory.key}</p>
                        <p className="mt-1 text-xs text-muted">
                          {memory.source} · {memory.updatedAt.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        className="shrink-0 rounded border border-border px-2 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
                        type="button"
                        onClick={() => deleteMemory(memory.key)}
                      >
                        ลบ
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">
                      {memory.value}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                Memories saved by the agent will appear here for this workspace.
              </p>
            )}
          </div>

          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-semibold">Tool Trace</p>
            <p className="mt-1 text-xs text-muted">{steps.length} events this run</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {steps.length ? (
              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <details
                    key={`${step.id}-${step.status}-${index}`}
                    className={`rounded-md border p-3 text-sm ${stepTone(step.status)}`}
                    open={step.status !== "started" && index > steps.length - 4}
                  >
                    <summary className="cursor-pointer font-semibold">
                      {step.tool} · {step.status}
                    </summary>
                    <p className="mt-2 text-xs opacity-80">{step.title}</p>
                    {step.error ? (
                      <p className="mt-2 text-xs font-semibold">{step.error}</p>
                    ) : null}
                    {step.input !== undefined ? (
                      <pre className="mt-3 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs">
                        {prettyJson(step.input)}
                      </pre>
                    ) : null}
                    {step.output !== undefined ? (
                      <pre className="mt-3 max-h-56 overflow-auto rounded bg-black/20 p-2 text-xs">
                        {prettyJson(step.output)}
                      </pre>
                    ) : null}
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                The agent trace will appear here as tools start, complete, or fail.
              </p>
            )}
          </div>
          {latestAnswer ? (
            <div className="border-t border-border px-5 py-4 text-xs text-muted">
              Final answer captured. The run is available in agent memory for future turns.
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
