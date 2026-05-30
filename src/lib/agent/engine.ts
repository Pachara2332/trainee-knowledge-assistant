import { getGeminiApiKeys } from "../chat/gemini";
import {
  formatMemoriesAsContext,
  getMemories,
  type AgentMemory,
} from "./memory";
import { agentToolDefinitions } from "./registry";
import { rememberAgentRun } from "./storage";
import { agentToolExecutors } from "./tools";
import type {
  AgentContext,
  AgentMessage,
  AgentRunResult,
  AgentToolName,
  AgentTraceStep,
} from "./types";

type GeminiPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_AGENT_STEPS = 8;

function pickGeminiApiKey() {
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    throw new Error("Gemini API key is not configured.");
  }

  return keys[Math.floor(Math.random() * keys.length)];
}

function getAgentModel() {
  return process.env.AGENT_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function now() {
  return new Date().toISOString();
}

function schemaForGemini(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(schemaForGemini);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(source)) {
    next[key] = key === "type" && typeof child === "string"
      ? child.toUpperCase()
      : schemaForGemini(child);
  }

  return next;
}

function toolDeclarationsForGemini() {
  return [
    {
      functionDeclarations: agentToolDefinitions.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: schemaForGemini(tool.parameters),
      })),
    },
  ];
}

function makeSystemPrompt(memories: AgentMemory[]) {
  return [
    "You are an AI agent with access to tools and persistent memory.",
    "You can plan, choose tools, execute them, inspect results, and then report the final answer.",
    "Use tools when they materially improve the answer. Prefer search_documents for workspace knowledge and web_search for current external information.",
    "If a tool is unavailable because an API key or database is missing, continue with the best available evidence and clearly mention the limitation.",
    "When the user asks you to create reports, send email, create tasks, inspect prior conversations, or use memory, call the matching tool.",
    "Use the remember tool to save important information for future runs.",
    "Use the recall tool to search for specific memories when needed.",
    "Keep the final answer concise, cite tool evidence by tool name, and summarize what actions were completed.",
    "",
    memories.length > 0
      ? [
          "## What you remember about this workspace:",
          formatMemoriesAsContext(memories),
        ].join("\n")
      : "## What you remember about this workspace:\nNo persistent memories are stored for this workspace yet.",
  ].join("\n");
}

async function callGemini(contents: GeminiContent[], signal?: AbortSignal) {
  const apiKey = pickGeminiApiKey();
  const model = getAgentModel();
  const timeoutSignal = AbortSignal.timeout(30_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal: requestSignal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        tools: toolDeclarationsForGemini(),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Gemini agent request failed with status ${response.status}.`);
  }

  return (await response.json()) as GeminiResponse;
}

function getText(parts: GeminiPart[]) {
  return parts.map((part) => part.text ?? "").join("");
}

function getToolCalls(parts: GeminiPart[]) {
  return parts
    .map((part) => part.functionCall)
    .filter((call): call is { name: string; args?: Record<string, unknown> } =>
      typeof call?.name === "string",
    );
}

function isAgentToolName(name: string): name is AgentToolName {
  return name in agentToolExecutors;
}

export async function runAgent({
  messages,
  context,
  onStep,
  onFinal,
}: {
  messages: AgentMessage[];
  context: AgentContext;
  onStep?: (step: AgentTraceStep) => void;
  onFinal?: (answer: string) => void;
}): Promise<AgentRunResult> {
  const latestUserRequest = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const trace: AgentTraceStep[] = [];
  let memories: AgentMemory[] = [];

  try {
    memories = await getMemories(context.workspaceId);
  } catch {
    memories = [];
  }

  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: makeSystemPrompt(memories) }],
    },
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: message.content }],
    })),
  ];

  for (let index = 0; index < MAX_AGENT_STEPS; index += 1) {
    const response = await callGemini(contents, context.signal);
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const toolCalls = getToolCalls(parts);

    contents.push({ role: "model", parts });

    if (toolCalls.length === 0) {
      const answer = getText(parts).trim() || "Done.";
      onFinal?.(answer);

      try {
        await rememberAgentRun({
          userId: context.userId,
          workspaceId: context.workspaceId,
          userRequest: latestUserRequest,
          answer,
        });
      } catch {
        /* Memory should not block the user-facing result. */
      }

      return { answer, trace };
    }

    const functionResponseParts: GeminiPart[] = [];

    for (const call of toolCalls) {
      const toolName = call.name;
      const args = call.args ?? {};
      const stepId = crypto.randomUUID();

      if (!isAgentToolName(toolName)) {
        const step: AgentTraceStep = {
          id: stepId,
          tool: "agent",
          title: `Unknown tool: ${toolName}`,
          status: "failed",
          input: args,
          error: "The model requested an unknown tool.",
          createdAt: now(),
        };
        trace.push(step);
        onStep?.(step);
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { ok: false, error: step.error },
          },
        });
        continue;
      }

      const started: AgentTraceStep = {
        id: stepId,
        tool: toolName,
        title: `Running ${toolName}`,
        status: "started",
        input: args,
        createdAt: now(),
      };
      trace.push(started);
      onStep?.(started);

      try {
        const result = await agentToolExecutors[toolName](args, context);
        const completed: AgentTraceStep = {
          ...started,
          status: result.ok ? "completed" : "failed",
          output: result.content,
          error:
            !result.ok && typeof result.content === "object" && result.content
              ? String((result.content as { error?: unknown }).error ?? "Tool failed.")
              : undefined,
        };
        trace.push(completed);
        onStep?.(completed);
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: {
              ok: result.ok,
              content: result.content,
            },
          },
        });
      } catch (error) {
        const failed: AgentTraceStep = {
          ...started,
          status: "failed",
          error: error instanceof Error ? error.message : "Tool failed.",
        };
        trace.push(failed);
        onStep?.(failed);
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { ok: false, error: failed.error },
          },
        });
      }
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  const answer =
    "I reached the maximum number of agent steps before a final response. Review the tool trace for partial results.";
  onFinal?.(answer);
  return { answer, trace };
}
