const DEFAULT_CHUNK = 1_400;
const DEFAULT_OVERLAP = 180;
const MAX_CHUNKS = 64;

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK,
  overlap = DEFAULT_OVERLAP,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let index = 0;

  while (index < normalized.length && chunks.length < MAX_CHUNKS) {
    chunks.push(normalized.slice(index, index + chunkSize));
    index += Math.max(1, chunkSize - overlap);
  }

  return chunks;
}
