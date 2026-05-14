import type { ChatAttachment, ChatMessage, GeminiPart, TokenUsage } from "./types";

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiStreamChunk = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 12_000;

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

export function getGeminiApiKeys() {
  return [
    ...(process.env.GEMINI_API_KEYS ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ].filter((key): key is string => Boolean(key));
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function latestUserIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

function buildContents(messages: ChatMessage[], attachment: ChatAttachment | null) {
  const contents: GeminiContent[] = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  if (!attachment) {
    return contents;
  }

  const index = latestUserIndex(messages);

  if (index === -1) {
    return contents;
  }

  const citationLabel = `Use the attached document as primary context. Cite it as [${attachment.name}] when the answer relies on it.`;
  const attachmentParts: GeminiPart[] =
    attachment.mimeType === "text/plain"
      ? [
          {
            text: `${citationLabel}\n\nDocument: ${attachment.name}\n\n${attachment.text ?? ""}`,
          },
        ]
      : [
          { text: citationLabel },
          {
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data ?? "",
            },
          },
        ];

  contents[index] = {
    ...contents[index],
    parts: [...attachmentParts, ...contents[index].parts],
  };

  return contents;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.trim().length / 4);
}

export function fallbackUsage(messages: ChatMessage[], answer: string): TokenUsage {
  const promptTokens = estimateTokenCount(
    messages.map((message) => message.content).join("\n"),
  );
  const completionTokens = estimateTokenCount(answer);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export async function streamGeminiAnswer({
  messages,
  attachment,
  signal,
  onText,
  onUsage,
}: {
  messages: ChatMessage[];
  attachment: ChatAttachment | null;
  signal?: AbortSignal;
  onText: (text: string) => void;
  onUsage: (usage: TokenUsage) => void;
}) {
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new GeminiError("Gemini API key is not configured.");
  }

  const timeoutSignal = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
  const model = getGeminiModel();
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
  const contents = buildContents(messages, attachment);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      signal: requestSignal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    const modelHint =
      response.status === 404
        ? `Model "${model}" is not available for this API key. Set GEMINI_MODEL to a model from ListModels, for example gemini-2.5-flash or gemini-2.0-flash.`
        : "";

    throw new GeminiError(
      [modelHint, errorText || `Gemini request failed with status ${response.status}.`]
        .filter(Boolean)
        .join(" "),
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

      const parsed = JSON.parse(data) as GeminiStreamChunk;
      const text =
        parsed.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? "";

      if (text) {
        onText(text);
      }

      if (parsed.usageMetadata) {
        onUsage({
          promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
          completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
        });
      }
    }
  }
}
