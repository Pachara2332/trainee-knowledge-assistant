import type { IEmbeddingFunction } from "chromadb";

/**
 * Chroma requires an embeddingFunction on the collection, but this project
 * always passes explicit vectors from Gemini — this stub should never run.
 */
export class StubEmbeddingFunction implements IEmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error("StubEmbeddingFunction: use explicit embeddings from Gemini.");
  }
}
