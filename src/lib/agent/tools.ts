import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ChromaClient, IncludeEnum } from "chromadb";
import { listConversationsForUser } from "../../repositories/chat-history";
import { embedTexts } from "../rag/embed-gemini";
import { StubEmbeddingFunction } from "../rag/stub-embedding-function";
import {
  formatMemoriesAsContext,
  searchMemories,
  setMemory,
} from "./memory";
import { createAgentReport, createAgentTask } from "./storage";
import type { AgentToolExecutor, AgentToolName, AgentToolResult } from "./types";

function collectionNameForWorkspace(workspaceId: string) {
  const safe = workspaceId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `workspace_${safe || "default"}`;
}

function textArg(args: Record<string, unknown>, key: string, fallback = "") {
  const value = args[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number) {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ok(content: unknown): AgentToolResult {
  return { ok: true, content };
}

function fail(message: string): AgentToolResult {
  return { ok: false, content: { error: message } };
}

function workspacePath(root: string, relativePath: string) {
  const resolved = path.resolve(root, relativePath);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (resolved !== root && !resolved.startsWith(rootWithSeparator)) {
    throw new Error("Path must stay inside the workspace.");
  }

  return resolved;
}

async function readWorkspaceFile(root: string, relativePath: string) {
  const resolved = workspacePath(root, relativePath);
  const text = await readFile(resolved, "utf8");
  return {
    path: relativePath,
    characters: text.length,
    text: text.slice(0, 24_000),
    truncated: text.length > 24_000,
  };
}

const searchDocuments: AgentToolExecutor = async (args, context) => {
  const query = textArg(args, "query");
  const limit = Math.max(1, Math.min(10, Math.floor(numberArg(args, "limit", 5))));
  const chromaUrl = process.env.CHROMA_URL?.trim();

  if (!query) {
    return fail("query is required.");
  }

  if (!chromaUrl) {
    return fail("CHROMA_URL is not configured.");
  }

  const client = new ChromaClient({ path: chromaUrl });
  const collection = await client.getOrCreateCollection({
    name: collectionNameForWorkspace(context.workspaceId),
    embeddingFunction: new StubEmbeddingFunction(),
  });
  const [queryEmbedding] = await embedTexts([query], context.signal);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
  });

  const documents = result.documents?.[0] ?? [];
  const metadatas = result.metadatas?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  return ok({
    query,
    results: documents
      .map((document, index) => ({
        text: document,
        metadata: metadatas[index],
        distance: distances[index],
      }))
      .filter((row) => Boolean(row.text)),
  });
};

const readDocument: AgentToolExecutor = async (args, context) => {
  const filePath = textArg(args, "path");

  if (!filePath) {
    return fail("path is required.");
  }

  try {
    return ok(await readWorkspaceFile(context.workspaceRoot, filePath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to read document.");
  }
};

const summarizeDocument: AgentToolExecutor = async (args, context) => {
  const filePath = textArg(args, "path");
  const focus = textArg(args, "focus");

  if (!filePath) {
    return fail("path is required.");
  }

  try {
    const file = await readWorkspaceFile(context.workspaceRoot, filePath);
    const paragraphs = file.text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 8);

    return ok({
      path: file.path,
      focus: focus || null,
      characters: file.characters,
      summary: paragraphs.join("\n\n").slice(0, 4000),
      truncated: file.truncated || paragraphs.length >= 8,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to summarize document.");
  }
};

const webSearch: AgentToolExecutor = async (args, context) => {
  const query = textArg(args, "query");
  const maxResults = Math.max(
    1,
    Math.min(10, Math.floor(numberArg(args, "maxResults", 5))),
  );
  const apiKey = process.env.TAVILY_API_KEY?.trim();

  if (!query) {
    return fail("query is required.");
  }

  if (!apiKey) {
    return fail("TAVILY_API_KEY is not configured.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: context.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return fail(body || `Tavily failed with status ${response.status}.`);
  }

  return ok(await response.json());
};

const createReport: AgentToolExecutor = async (args, context) => {
  const title = textArg(args, "title");
  const markdown = textArg(args, "markdown");

  if (!title || !markdown) {
    return fail("title and markdown are required.");
  }

  try {
    return ok(
      await createAgentReport({
        userId: context.userId,
        workspaceId: context.workspaceId,
        title,
        markdown,
      }),
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create report.");
  }
};

const sendEmail: AgentToolExecutor = async (args, context) => {
  const to = textArg(args, "to");
  const subject = textArg(args, "subject");
  const markdown = textArg(args, "markdown");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!to || !subject || !markdown) {
    return fail("to, subject, and markdown are required.");
  }

  if (!apiKey || !from) {
    return fail("RESEND_API_KEY and RESEND_FROM_EMAIL are not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: context.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: markdown,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return fail(body?.message ?? `Resend failed with status ${response.status}.`);
  }

  return ok(body);
};

const executeCode: AgentToolExecutor = async (args) => {
  const code = textArg(args, "code");

  if (!code) {
    return fail("code is required.");
  }

  if (process.env.AGENT_ENABLE_CODE_EXECUTION !== "true") {
    return fail("Code execution is disabled. Set AGENT_ENABLE_CODE_EXECUTION=true to enable it.");
  }

  return new Promise((resolve) => {
    const child = spawn("python", ["-I", "-c", code], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(fail("Python execution timed out."));
    }, 5000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve(fail(error.message));
    });
    child.on("close", (codeNumber) => {
      clearTimeout(timer);
      resolve(
        ok({
          exitCode: codeNumber,
          stdout: stdout.slice(0, 8000),
          stderr: stderr.slice(0, 4000),
        }),
      );
    });
  });
};

const listConversations: AgentToolExecutor = async (args, context) => {
  const limit = Math.max(1, Math.min(20, Math.floor(numberArg(args, "limit", 10))));
  const conversations = await listConversationsForUser({
    userId: context.userId,
    workspaceId: context.workspaceId,
  });

  return ok({
    conversations: conversations.slice(0, limit).map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.slice(-4).map((message) => ({
        role: message.role,
        content: message.content.slice(0, 600),
        createdAt: message.createdAt,
      })),
    })),
  });
};

const createTask: AgentToolExecutor = async (args, context) => {
  const title = textArg(args, "title");
  const detail = textArg(args, "detail") || null;

  if (!title) {
    return fail("title is required.");
  }

  try {
    return ok(
      await createAgentTask({
        userId: context.userId,
        workspaceId: context.workspaceId,
        title,
        detail,
      }),
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create task.");
  }
};

const remember: AgentToolExecutor = async (args, context) => {
  const key = textArg(args, "key");
  const value = textArg(args, "value");

  if (!key || !value) {
    return fail("key and value are required.");
  }

  try {
    const memory = await setMemory(
      context.workspaceId,
      context.userId,
      key,
      value,
      "agent",
    );
    return ok(`บันทึก memory "${memory.key}" แล้ว`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save memory.");
  }
};

const recall: AgentToolExecutor = async (args, context) => {
  const query = textArg(args, "query");

  try {
    const memories = await searchMemories(context.workspaceId, query);
    return ok(formatMemoriesAsContext(memories));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to recall memory.");
  }
};

export const agentToolExecutors: Record<AgentToolName, AgentToolExecutor> = {
  search_documents: searchDocuments,
  read_document: readDocument,
  summarize_document: summarizeDocument,
  web_search: webSearch,
  create_report: createReport,
  send_email: sendEmail,
  execute_code: executeCode,
  list_conversations: listConversations,
  create_task: createTask,
  remember,
  recall,
};
