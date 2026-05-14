import { createHash } from "crypto";
import { getGeminiApiKeys } from "../chat/gemini";

const EMBED_MODEL = "text-embedding-004";
const EMBED_TIMEOUT_MS = 15_000;

type BatchEmbedResponse = {
  embeddings?: Array<{ values?: number[] }>;
};

function pickApiKey() {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("Gemini API key is not configured for embeddings.");
  }

  return keys[Math.floor(Math.random() * keys.length)];
}

export async function embedTexts(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = pickApiKey();
  const timeoutSignal = AbortSignal.timeout(EMBED_TIMEOUT_MS);
  const merged = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      signal: merged,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
        })),
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Gemini embedding failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = (await response.json()) as BatchEmbedResponse;
  const vectors = data.embeddings?.map((row) => row.values ?? []) ?? [];

  if (vectors.length !== texts.length) {
    throw new Error("Gemini embedding response size mismatch.");
  }

  return vectors;
}

export function hashDocKey(fileName: string, fullText: string) {
  const digest = createHash("sha256").update(fileName).update("\n").update(fullText).digest("hex");
  return digest.slice(0, 24);
}
