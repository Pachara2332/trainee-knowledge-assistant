import { ChromaClient } from "chromadb";
const url = process.env.CHROMA_URL ?? "http://localhost:8000";
export function getChromaClient() {
  return new ChromaClient({ path: url });
}
export async function getDocsCollection(userId: string) {
  const client = getChromaClient();
  // แยก collection ต่อ user หรือใช้ collection เดียว + metadata filter ก็ได้
  return client.getOrCreateCollection({
    name: `user_${userId}_docs`,
  });
}