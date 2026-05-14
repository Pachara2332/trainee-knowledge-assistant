import { describe, expect, it } from "vitest";
import { StubEmbeddingFunction } from "./stub-embedding-function";

describe("StubEmbeddingFunction", () => {
  it("throws because embeddings are supplied explicitly", async () => {
    const fn = new StubEmbeddingFunction();
    await expect(fn.generate(["hello"])).rejects.toThrow(/explicit embeddings/i);
  });
});
