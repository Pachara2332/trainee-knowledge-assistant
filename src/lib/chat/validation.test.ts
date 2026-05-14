import { describe, expect, it } from "vitest";
import {
  ChatValidationError,
  normalizeAttachment,
  normalizeMessages,
  sanitizeFileName,
} from "./validation";

describe("sanitizeFileName", () => {
  it("strips unsafe characters and caps length", () => {
    expect(sanitizeFileName("  report<script>.txt  ")).toBe("reportscript.txt");
    expect(sanitizeFileName("")).toBe("attachment");
    expect(sanitizeFileName("a".repeat(200)).length).toBe(120);
  });
});

describe("normalizeMessages", () => {
  it("accepts valid user and assistant messages", () => {
    const out = normalizeMessages([
      { role: "user", content: " Hi " },
      { role: "assistant", content: "Hello" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("keeps only the last 20 messages", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      role: "user" as const,
      content: `m${index}`,
    }));
    const out = normalizeMessages(many);
    expect(out).toHaveLength(20);
    expect(out[0].content).toBe("m5");
    expect(out[19].content).toBe("m24");
  });

  it("throws when payload is not an array", () => {
    expect(() => normalizeMessages(null)).toThrow(ChatValidationError);
  });

  it("throws on invalid role", () => {
    expect(() =>
      normalizeMessages([{ role: "system", content: "x" }]),
    ).toThrow(ChatValidationError);
  });

  it("throws on empty content", () => {
    expect(() => normalizeMessages([{ role: "user", content: "   " }])).toThrow(
      ChatValidationError,
    );
  });
});

describe("normalizeAttachment", () => {
  it("returns null for non-object", () => {
    expect(normalizeAttachment(null)).toBeNull();
  });

  it("accepts plain text attachment", () => {
    const attachment = normalizeAttachment({
      name: "notes.txt",
      mimeType: "text/plain",
      text: "hello world",
      data: "",
    });
    expect(attachment?.mimeType).toBe("text/plain");
    expect(attachment?.text).toContain("hello");
  });

  it("accepts pdf with base64 data", () => {
    const attachment = normalizeAttachment({
      name: "doc.pdf",
      mimeType: "application/pdf",
      text: "",
      data: "abcd",
    });
    expect(attachment?.mimeType).toBe("application/pdf");
  });

  it("rejects unsupported mime types", () => {
    expect(() =>
      normalizeAttachment({ name: "x", mimeType: "image/png", text: "a", data: "" }),
    ).toThrow(ChatValidationError);
  });

  it("rejects empty content", () => {
    expect(() =>
      normalizeAttachment({ name: "x", mimeType: "text/plain", text: "", data: "" }),
    ).toThrow(ChatValidationError);
  });
});
