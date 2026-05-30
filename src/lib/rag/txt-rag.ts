import { ChromaClient, IncludeEnum } from "chromadb";
import { chunkText } from "./chunk-text";
import { embedTexts, hashDocKey } from "./embed-gemini";
import { StubEmbeddingFunction } from "./stub-embedding-function";

export function collectionNameForWorkspace(workspaceId: string) {
  const safe = workspaceId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `workspace_${safe || "default"}`;
}

async function getCollection(workspaceId: string) {
  const path = process.env.CHROMA_URL?.trim();
  if (!path) {
    throw new Error("CHROMA_URL is not set.");
  }

  const client = new ChromaClient({ path });
  return client.getOrCreateCollection({
    name: collectionNameForWorkspace(workspaceId),
    embeddingFunction: new StubEmbeddingFunction(),
  });
}

/**
 * Indexes text chunks into Chroma (per user collection), retrieves top excerpts for the question,
 * and returns text suitable to inject as attachment context.
 */
export async function buildDocumentRagContext({
  workspaceId,
  fileName,
  fullText,
  userQuestion,
  signal,
}: {
  workspaceId: string;
  fileName: string;
  fullText: string;
  userQuestion: string;
  signal?: AbortSignal;
}): Promise<string> {
  const chunks = chunkText(fullText);
  if (chunks.length === 0) {
    return fullText;
  }

  const docKey = hashDocKey(fileName, fullText);
  const collection = await getCollection(workspaceId);

  try {
    await collection.delete({
      where: { docKey: { $eq: docKey } },
    });
  } catch {
    /* ignore if nothing to delete */
  }

  const embeddings = await embedTexts(chunks, signal);
  const ids = chunks.map((_, index) => `${docKey}_c${index}`);
  const metadatas = chunks.map((_, index) => ({
    docKey,
    fileName,
    chunkIndex: index,
  }));

  await collection.add({
    ids,
    embeddings,
    documents: chunks,
    metadatas,
  });

  const [queryEmbedding] = await embedTexts([userQuestion], signal);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: Math.min(10, Math.max(3, chunks.length)),
    where: { docKey: { $eq: docKey } },
    include: [IncludeEnum.Documents, IncludeEnum.Distances],
  });

  const rows = result.documents?.[0]?.filter((d): d is string => Boolean(d)) ?? [];

  if (rows.length === 0) {
    return [
      `Retrieved context from [${fileName}] was empty; here is the start of the file instead:`,
      "",
      fullText.slice(0, 12_000),
    ].join("\n");
  }

  return [
    `The following excerpts were retrieved from [${fileName}] using vector similarity (Chroma) to the latest user question.`,
    "Treat them as the primary evidence; cite as [" + fileName + "] when you rely on them.",
    "",
    rows.map((row, index) => `--- Excerpt ${index + 1} ---\n${row}`).join("\n\n"),
  ].join("\n");
}

export const buildTxtRagContext = buildDocumentRagContext;
