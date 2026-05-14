import { describe, expect, it } from "vitest";
import { estimateTokenCount, fallbackUsage } from "./gemini";

describe("estimateTokenCount", () => {
  it("rounds up by quarter characters", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("  abcd  ")).toBe(1);
  });
});

describe("fallbackUsage", () => {
  it("sums prompt and completion estimates", () => {
    const usage = fallbackUsage([{ role: "user", content: "abcd" }], "efgh");
    expect(usage.promptTokens).toBe(estimateTokenCount("abcd"));
    expect(usage.completionTokens).toBe(estimateTokenCount("efgh"));
    expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);
  });
});
