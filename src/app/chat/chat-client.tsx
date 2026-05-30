"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { logOut } from "../actions";
import { ChatComposer } from "../../components/chat/chat-composer";
import { toClientAttachment } from "../../components/chat/file-attachment";
import { MessageList } from "../../components/chat/message-list";
import type { ClientAttachment, Message, TokenUsage } from "../../components/chat/types";
import { parseSseEvents } from "./sse-events";
import { useChatConversations } from "./use-chat-conversations";

type Theme = "dark" | "light";

type Project = {
  id: string;
  name: string;
  instructions: string;
  files: ClientAttachment[];
};

type Workspace = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

function displayTitle(title: string) {
  return title || "New chat";
}

function displayName(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name.trim();
  }

  return email?.split("@")[0] || "Trainee";
}

function isEmptyChat(messages: Message[]) {
  return (
    messages.length === 0 ||
    (messages.length === 1 && messages[0].id === "welcome")
  );
}

function Avatar({ label, image, compact = false }: { label: string; image?: string | null; compact?: boolean }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={label}
        className={`shrink-0 rounded-full object-cover ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-[#e8e8e8] text-sm font-bold text-black ${
        compact ? "h-8 w-8" : "h-9 w-9"
      }`}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

function NavLabel({ children, show }: { children: React.ReactNode; show: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.16 }}
          className="truncate"
        >
          {children}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function SettingsDialog({
  email,
  name,
  image,
  theme,
  onThemeChange,
  onClose,
}: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}) {
  const accountName = displayName(name, email);
  const isLight = theme === "light";
  const panelClass = isLight
    ? "border-[#d9dce2] bg-[#f7f7f8] text-[#111]"
    : "border-[#262626] bg-[#111214] text-white";
  const mutedTextClass = isLight ? "text-[#666b74]" : "text-[#9b9b9b]";

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className={`w-full max-w-[760px] rounded-3xl border p-4 shadow-2xl sm:p-6 ${panelClass}`}
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <button
            className="grid h-9 w-9 place-items-center rounded-full text-[#9b9b9b] transition hover:bg-[#222] hover:text-white"
            type="button"
            onClick={onClose}
            aria-label="Close settings"
          >
            x
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[170px_minmax(0,1fr)]">
          <nav className="grid content-start gap-1 text-sm font-semibold">
            {["Account", "Appearance", "Behavior", "Data Controls"].map(
              (item, index) => (
                <button
                  key={item}
                  className={`rounded-xl px-4 py-3 text-left transition ${
                    index === 0
                      ? isLight
                        ? "bg-[#e6e7eb] text-[#111]"
                        : "bg-[#2a2a2a] text-white"
                      : isLight
                        ? "text-[#555a63] hover:bg-[#eceef2] hover:text-[#111]"
                        : "text-[#cfcfcf] hover:bg-[#202020] hover:text-white"
                  }`}
                  type="button"
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="min-w-0">
            <div className={`flex items-center gap-4 border-b pb-5 ${isLight ? "border-[#d9dce2]" : "border-[#262626]"}`}>
              <Avatar label={accountName} image={image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{accountName}</p>
                <p className={`truncate text-sm ${mutedTextClass}`}>{email}</p>
              </div>
              <button
                className="ml-auto rounded-xl border border-[#373737] px-4 py-2 text-sm font-semibold text-[#f2f2f2] transition hover:border-[#666]"
                type="button"
              >
                Manage
              </button>
            </div>

            <div className={`divide-y text-sm ${isLight ? "divide-[#d9dce2]" : "divide-[#262626]"}`}>
              <div className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="font-semibold">Language</p>
                  <p className={`mt-1 ${mutedTextClass}`}>System default</p>
                </div>
                <button className="rounded-xl border border-[#373737] px-4 py-2 font-semibold transition hover:border-[#666]" type="button">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="font-semibold">Theme</p>
                  <p className={`mt-1 ${mutedTextClass}`}>
                    {isLight ? "Light" : "Dark"}
                  </p>
                </div>
                <button
                  className="rounded-xl border border-[#373737] px-4 py-2 font-semibold transition hover:border-[#666]"
                  type="button"
                  onClick={() => onThemeChange(isLight ? "dark" : "light")}
                >
                  {isLight ? "Use dark" : "Use light"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="font-semibold">Project sources</p>
                  <p className={`mt-1 ${mutedTextClass}`}>Add PDF and TXT files from New Project.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function ProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (project: Project) => void;
}) {
  const [step, setStep] = useState<"details" | "sources">("details");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<ClientAttachment[]>([]);
  const [error, setError] = useState("");
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);

  async function addFiles(fileList: FileList | File[]) {
    const nextFiles = Array.from(fileList);

    try {
      const attachments = await Promise.all(nextFiles.map((file) => toClientAttachment(file)));
      setFiles((current) => [...current, ...attachments]);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add source files.");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function createProject() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Project name is required.");
      setStep("details");
      return;
    }

    onCreate({
      id: crypto.randomUUID(),
      name: trimmedName,
      instructions: instructions.trim(),
      files,
    });
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="w-full max-w-[672px] rounded-[22px] border border-[#24262a] bg-[#111214] p-5 text-white shadow-2xl"
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ duration: 0.2 }}
      >
        {step === "details" ? (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="text-xl text-[#ff8bd2]">o</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-white outline-none placeholder:text-[#8c8c8c]"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Project name"
                autoFocus
              />
              <button
                className="grid h-8 w-8 place-items-center rounded-full text-[#9b9b9b] transition hover:bg-[#222] hover:text-white"
                type="button"
                onClick={onClose}
                aria-label="Close project dialog"
              >
                x
              </button>
            </div>

            <label className="grid gap-3 text-sm font-semibold">
              Project Instructions
              <textarea
                className="min-h-[132px] resize-none rounded-xl border border-[#303238] bg-[#111214] px-3 py-3 text-sm font-medium text-white outline-none placeholder:text-[#8c8c8c] focus:border-[#565a63]"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Add instructions about the tone, style, and persona you want the assistant to adopt."
              />
            </label>

            {error ? <p className="mt-3 text-sm font-semibold text-[#ff9b9b]">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-[#33363d] px-4 py-2 text-sm font-semibold transition hover:border-[#666]"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8e8e8]"
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setError("Project name is required.");
                    return;
                  }
                  setError("");
                  setStep("sources");
                }}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Project Sources</h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-full text-[#9b9b9b] transition hover:bg-[#222] hover:text-white"
                type="button"
                onClick={onClose}
                aria-label="Close project sources"
              >
                x
              </button>
            </div>
            <p className="mb-6 text-sm text-[#9b9b9b]">
              Provide context for your project so the assistant can use it to answer questions.
            </p>

            <input
              ref={projectFileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                }
              }}
            />

            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>Files</span>
                <span className="text-[#9b9b9b]">({files.length})</span>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#33363d] text-xl leading-none transition hover:border-[#666] hover:bg-[#1d1d1d]"
                type="button"
                onClick={() => projectFileInputRef.current?.click()}
                title="Add files"
              >
                +
              </button>
            </div>

            <div
              className="grid min-h-[160px] place-items-center rounded-xl border border-dashed border-[#2a2d34] bg-[#101114] px-4 py-6 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {files.length ? (
                <div className="grid w-full gap-2 text-left">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#252830] bg-[#15161a] px-3 py-2 text-sm"
                    >
                      <span className="truncate font-semibold">{file.name}</span>
                      <button
                        className="text-[#9b9b9b] transition hover:text-white"
                        type="button"
                        onClick={() =>
                          setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="font-semibold">Drag & drop files here</p>
                  <p className="mt-1 text-sm text-[#9b9b9b]">or use the button above</p>
                </div>
              )}
            </div>

            {error ? <p className="mt-3 text-sm font-semibold text-[#ff9b9b]">{error}</p> : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="text-sm font-semibold text-[#9b9b9b] transition hover:text-white"
                type="button"
                onClick={createProject}
              >
                Add sources later
              </button>
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8e8e8]"
                type="button"
                onClick={createProject}
              >
                Create
              </button>
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}

export function ChatClient({
  email,
  name,
  image,
}: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const {
    activeConversation,
    conversations,
    messages,
    createNewConversation,
    deleteConversation,
    ensureConversationPersisted,
    historyError,
    isHistoryLoading,
    selectConversation,
    updateConversationMessages,
    updateDraftTitle,
  } = useChatConversations(currentWorkspaceId);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [attachedFile, setAttachedFile] = useState<ClientAttachment | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("knowledge-assistant-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTimeout(() => {
        setTheme(savedTheme);
      }, 0);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    window.localStorage.setItem("knowledge-assistant-theme", theme);
  }, [theme]);

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
        setWorkspaceError("");
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error ? error.message : "Unable to load workspaces.",
          );
        }
      }
    }

    loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedLandingPromptRef = useRef(false);
  const accountName = displayName(name, email);
  const emptyChat = isEmptyChat(messages);

  useEffect(() => {
    if (hydratedLandingPromptRef.current) {
      return;
    }

    const landingPrompt = window.sessionStorage.getItem("landingPrompt");

    if (!landingPrompt) {
      return;
    }

    hydratedLandingPromptRef.current = true;
    window.sessionStorage.removeItem("landingPrompt");

    const timer = window.setTimeout(() => {
      setInput(landingPrompt);
      updateDraftTitle(landingPrompt);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [updateDraftTitle]);

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
    deleteConversation(conversationId).catch((error) => {
      setError(error instanceof Error ? error.message : "Unable to delete chat.");
    });
    resetComposer();
  }

  function handleInputChange(value: string) {
    setInput(value);
    updateDraftTitle(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isStreaming || isHistoryLoading) {
      return;
    }

    setError("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
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
      const conversationId = await ensureConversationPersisted(
        activeConversation.id,
        text,
      );
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
      setAttachedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
          attachment: attachedFile,
          conversationId,
          workspaceId: currentWorkspaceId,
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

  function addProject(project: Project) {
    setProjects((current) => [project, ...current]);
    setIsProjectDialogOpen(false);
  }

  function sidebarItemClass(active = false) {
    return `flex h-10 items-center rounded-xl text-sm font-semibold transition ${
      isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
    } ${
      active
        ? isLightTheme
          ? "bg-[#eceef2] text-[#111] hover:bg-[#e3e5ea]"
          : "bg-[#1d1d1d] text-white hover:bg-[#292929]"
        : isLightTheme
          ? "text-[#555a63] hover:bg-[#f0f1f4] hover:text-[#111]"
          : "text-[#d0d0d0] hover:bg-[#191919] hover:text-white"
    }`;
  }

  const isLightTheme = theme === "light";

  return (
    <div
      className={`relative z-10 flex h-screen min-h-0 ${
        isLightTheme ? "bg-[#f7f7f8] text-[#111]" : "bg-[#030303] text-white"
      }`}
    >
      <motion.aside
        className={`hidden min-h-0 shrink-0 border-r px-2 py-4 lg:flex lg:flex-col ${
          isLightTheme
            ? "border-[#dedfe4] bg-white"
            : "border-[#171717] bg-[#050505]"
        }`}
        animate={{ width: isSidebarCollapsed ? 64 : 252 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className={`mb-6 flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between px-1"}`}>
          <Link
            href="/chat"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#282828] text-sm font-semibold"
            aria-label="Knowledge home"
          >
            K
          </Link>
          {!isSidebarCollapsed ? (
            <button
              className="grid h-9 w-9 place-items-center rounded-xl text-[#8d8d8d] transition hover:bg-[#222] hover:text-white"
              type="button"
              aria-label="Collapse sidebar"
              title="Collapse"
              onClick={() => setIsSidebarCollapsed(true)}
            >
              &lt;&lt;
            </button>
          ) : null}
        </div>

        <nav className="grid gap-1">
          <button
            className={sidebarItemClass(true)}
            type="button"
            disabled={isStreaming || isHistoryLoading}
            onClick={handleNewChat}
            title="New Chat"
          >
            <span className="w-5 text-center">+</span>
            <NavLabel show={!isSidebarCollapsed}>New Chat</NavLabel>
          </button>
        </nav>

        <div className="mt-7 grid gap-3 text-sm">
          {!isSidebarCollapsed ? (
            <label className="grid gap-2 px-3 text-xs font-semibold text-[#8d8d8d]">
              Workspace
              <select
                className="h-10 rounded-md border border-[#262626] bg-[#101010] px-2 text-sm font-semibold text-white outline-none"
                value={currentWorkspaceId ?? ""}
                onChange={(event) => {
                  setCurrentWorkspaceId(event.target.value || null);
                  createNewConversation();
                }}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div>
            {!isSidebarCollapsed ? (
              <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-white">
                <span>Projects</span>
                <span className="text-[#8d8d8d]">v</span>
              </div>
            ) : null}
            <button
              className={sidebarItemClass()}
              type="button"
              onClick={() => setIsProjectDialogOpen(true)}
              title="New Project"
            >
              <span className="w-5 text-center">+</span>
              <NavLabel show={!isSidebarCollapsed}>New Project</NavLabel>
            </button>
            {!isSidebarCollapsed && projects.length ? (
              <div className="mt-1 grid gap-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="min-w-0 truncate rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#d0d0d0] transition hover:bg-[#141414] hover:text-white"
                    type="button"
                    title={`${project.name} (${project.files.length} files)`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-h-0">
            {!isSidebarCollapsed ? (
              <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-white">
                <span>History</span>
                <span className="text-[#8d8d8d]">v</span>
              </div>
            ) : null}
            <div className="grid max-h-[42vh] gap-1 overflow-y-auto pr-1">
              {isSidebarCollapsed ? (
                <button
                  className={sidebarItemClass()}
                  type="button"
                  title="History"
                >
                  <span className="w-5 text-center">@</span>
                </button>
              ) : conversations.length ? (
                conversations.map((conversation) => (
                  <motion.div
                    layout
                    key={conversation.id}
                    className={`group flex min-w-0 items-center rounded-xl ${
                      conversation.id === activeConversation.id
                        ? "bg-[#191919] text-white"
                        : "text-[#d0d0d0] hover:bg-[#141414] hover:text-white"
                    }`}
                  >
                    <button
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm font-semibold disabled:cursor-not-allowed"
                      type="button"
                      disabled={isStreaming || isHistoryLoading}
                      title={displayTitle(conversation.title)}
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      {displayTitle(conversation.title)}
                    </button>
                    <button
                      className="px-3 text-xs font-semibold text-[#777] opacity-0 transition hover:text-white group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                      type="button"
                      disabled={isStreaming || isHistoryLoading}
                      title={`Delete ${displayTitle(conversation.title)}`}
                      onClick={() => handleDeleteConversation(conversation.id)}
                    >
                      x
                    </button>
                  </motion.div>
                ))
              ) : (
                <p className="px-3 py-2 text-xs leading-5 text-[#777]">
                  Your chats will appear here.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-auto pt-4">
          {isSidebarCollapsed ? (
            <button
              className="mb-4 grid h-10 w-full place-items-center rounded-xl text-[#9b9b9b] transition hover:bg-[#1a1a1a] hover:text-white"
              type="button"
              aria-label="Expand sidebar"
              title="Expand"
              onClick={() => setIsSidebarCollapsed(false)}
            >
              &gt;&gt;
            </button>
          ) : null}

          <AnimatePresence>
            {isProfileOpen && !isSidebarCollapsed ? (
              <motion.div
                className="absolute bottom-[64px] left-0 right-0 rounded-2xl border border-[#303030] bg-[#242424] p-2 shadow-2xl"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#f0f0f0] transition hover:bg-[#303030]"
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setIsProfileOpen(false);
                  }}
                >
                  <span className="w-4 text-center">o</span>
                  <span>Settings</span>
                </button>
                <form action={logOut}>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#f0f0f0] transition hover:bg-[#303030]">
                    <span className="w-4 text-center">x</span>
                    <span>Log out</span>
                  </button>
                </form>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            className={`flex w-full min-w-0 items-center rounded-xl py-2 text-left transition hover:bg-[#141414] ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-2"
            }`}
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
            title={accountName}
          >
            <Avatar label={accountName} image={image} compact={isSidebarCollapsed} />
            <NavLabel show={!isSidebarCollapsed}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{accountName}</span>
                <span className="block truncate text-xs text-[#9b9b9b]">{email}</span>
              </span>
            </NavLabel>
          </button>
        </div>
      </motion.aside>

      <section className="relative flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between px-4 text-sm font-semibold sm:px-8">
          <Link
            href="/chat"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#282828] text-sm lg:hidden"
            aria-label="Knowledge home"
          >
            K
          </Link>
          <div className="ml-auto" />
        </div>

        {emptyChat ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-20">
            <motion.div
              className="mb-8 flex items-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border border-[#313131] bg-[#0d0d0d] text-2xl font-semibold text-white">
                K
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Knowledge
              </h1>
            </motion.div>
            <ChatComposer
              input={input}
              attachedFile={attachedFile}
              isStreaming={isStreaming || isHistoryLoading}
              isCentered
              fileInputRef={fileInputRef}
              onInputChange={handleInputChange}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onSubmit={handleSubmit}
              onStop={() => abortRef.current?.abort()}
            />
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            <ChatComposer
              input={input}
              attachedFile={attachedFile}
              isStreaming={isStreaming || isHistoryLoading}
              fileInputRef={fileInputRef}
              onInputChange={handleInputChange}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onSubmit={handleSubmit}
              onStop={() => abortRef.current?.abort()}
            />
          </>
        )}

        {workspaceError || historyError || error ? (
          <div className="mx-auto mb-3 w-[min(100%-2rem,800px)] rounded-2xl border border-[#4d2424] bg-[#241010] px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
            {workspaceError || historyError || error}
          </div>
        ) : null}
      </section>

      <AnimatePresence>
        {isSettingsOpen ? (
          <SettingsDialog
            email={email}
            name={name}
            image={image}
            theme={theme}
            onThemeChange={setTheme}
            onClose={() => setIsSettingsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isProjectDialogOpen ? (
          <ProjectDialog
            onClose={() => setIsProjectDialogOpen(false)}
            onCreate={addProject}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
