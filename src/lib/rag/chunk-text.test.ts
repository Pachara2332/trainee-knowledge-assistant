import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-text";

describe("chunkText", () => {
  it("returns empty array for blank input", () => {
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("normalizes CRLF", () => {
    const chunks = chunkText("a\r\nb", 4, 0);
    expect(chunks.join("")).toBe("a\nb");
  });

  it("splits long text into overlapping chunks", () => {
    const text = "x".repeat(100);
    const chunks = chunkText(text, 30, 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toContain("x");
  });
});
