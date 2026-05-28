import type { ChatAttachment, ChatMessage, TokenUsage } from "./types";
import { fallbackUsage, streamGeminiAnswer } from "./gemini";

type ProviderName = "Gemini" | "OpenRouter" | "Groq" | "OpenAI" | "Together" | "Cerebras";

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type ProviderConfig = {
  name: ProviderName;
  apiKey?: string;
  endpoint: string;
  model: string;
  extraHeaders?: Record<string, string>;
};

const FALLBACK_TIMEOUT_MS = 12_000;

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function toPrompt(messages: ChatMessage[], attachment: ChatAttachment | null) {
  const history = messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n\n");

  if (!attachment) {
    return history;
  }

  if (attachment.mimeType === "text/plain") {
    return [
      `Use the attached document as primary context. Cite it as [${attachment.name}] when the answer relies on it.`,
      "",
      `Document: ${attachment.name}`,
      attachment.text ?? "",
      "",
      history,
    ].join("\n");
  }

  return [
    "A PDF was attached, but this fallback provider can only receive text context in the current implementation.",
    "Answer the user's latest question from the conversation only. If the answer requires the PDF, say that the PDF needs Gemini or text extraction first.",
    "",
    history,
  ].join("\n");
}

function buildOpenAiMessages(messages: ChatMessage[], attachment: ChatAttachment | null) {
  return [
    {
      role: "system",
      content:
        "You are a concise knowledge assistant. Use markdown when helpful. If document context is provided, cite it with the filename in square brackets.",
    },
    {
      role: "user",
      content: toPrompt(messages, attachment),
    },
  ];
}

function providerConfigs() {
  const configs: ProviderConfig[] = [
    {
      name: "OpenRouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
      extraHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "Knowledge Assistant",
      },
    },
    {
      name: "Groq",
      apiKey: process.env.GROQ_API_KEY,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    },
    {
      name: "Together",
      apiKey: process.env.TOGETHER_API_KEY,
      endpoint: "https://api.together.xyz/v1/chat/completions",
      model: process.env.TOGETHER_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    },
    {
      name: "Cerebras",
      apiKey: process.env.CEREBRAS_API_KEY,
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      model: process.env.CEREBRAS_MODEL || "llama3.1-8b",
    },
    {
      name: "OpenAI",
      apiKey: process.env.OPENAI_API_KEY,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
  ];

  return configs.filter((config) => Boolean(config.apiKey));
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function streamChatCompletions({
  config,
  messages,
  attachment,
  signal,
  onText,
  onUsage,
}: {
  config: ProviderConfig;
  messages: ChatMessage[];
  attachment: ChatAttachment | null;
  signal?: AbortSignal;
  onText: (text: string) => void;
  onUsage: (usage: TokenUsage) => void;
}) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    signal: withTimeout(signal, FALLBACK_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...config.extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildOpenAiMessages(messages, attachment),
      stream: true,
      stream_options: {
        include_usage: true,
      },
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new AiProviderError(
      `${config.name} failed: ${errorText || response.statusText || response.status}`,
    );
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
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

      if (!data || data === "[DONE]") {
        continue;
      }

      const parsed = JSON.parse(data) as ChatCompletionChunk;
      const text = parsed.choices?.[0]?.delta?.content ?? "";

      if (text) {
        onText(text);
      }

      if (parsed.usage) {
        onUsage({
          promptTokens: parsed.usage.prompt_tokens ?? 0,
          completionTokens: parsed.usage.completion_tokens ?? 0,
          totalTokens: parsed.usage.total_tokens ?? 0,
        });
      }
    }
  }
}

export async function streamAiAnswer({
  messages,
  attachment,
  signal,
  onText,
  onUsage,
  onProvider,
}: {
  messages: ChatMessage[];
  attachment: ChatAttachment | null;
  signal?: AbortSignal;
  onText: (text: string) => void;
  onUsage: (usage: TokenUsage) => void;
  onProvider?: (provider: ProviderName) => void;
}) {
  const errors: string[] = [];
  const providers = [
    {
      name: "Gemini" as const,
      run: (callbacks: {
        onText: (text: string) => void;
        onUsage: (usage: TokenUsage) => void;
      }) =>
        streamGeminiAnswer({
          messages,
          attachment,
          signal,
          onText: callbacks.onText,
          onUsage: callbacks.onUsage,
        }),
    },
    ...providerConfigs().map((config) => ({
      name: config.name,
      run: (callbacks: {
        onText: (text: string) => void;
        onUsage: (usage: TokenUsage) => void;
      }) =>
        streamChatCompletions({
          config,
          messages,
          attachment,
          signal,
          onText: callbacks.onText,
          onUsage: callbacks.onUsage,
        }),
    })),
  ];

  if (providers.length === 0) {
    throw new AiProviderError("No AI provider API key is configured.");
  }

  for (const provider of providers) {
    let answer = "";

    try {
      onProvider?.(provider.name);
      await provider.run({
        onText(text) {
          answer += text;
          onText(text);
        },
        onUsage,
      });

      if (!answer) {
        throw new AiProviderError(`${provider.name} returned an empty answer.`);
      }

      return;
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? `${provider.name} timed out.`
          : error instanceof Error
            ? error.message
            : `${provider.name} failed.`;

      errors.push(message);
    }
  }

  throw new AiProviderError(
    errors.length > 0 ? errors.join(" ") : "All AI providers failed.",
  );
}

export function fallbackAiUsage(messages: ChatMessage[], answer: string) {
  return fallbackUsage(messages, answer);
}
