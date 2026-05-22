import { describe, expect, it } from "vitest";
import { getChatHistoryKey } from "./use-chat-conversations";

describe("getChatHistoryKey", () => {
  it("normalizes email before building the localStorage key", () => {
    expect(getChatHistoryKey(" Trainee@Example.COM ")).toBe(
      "knowledge-assistant.chat-conversations.trainee%40example.com",
    );
  });

  it("uses a different key for each user account", () => {
    expect(getChatHistoryKey("a@example.com")).not.toBe(
      getChatHistoryKey("b@example.com"),
    );
  });

  it("uses an anonymous key when no email is available", () => {
    expect(getChatHistoryKey(null)).toBe(
      "knowledge-assistant.chat-conversations.anonymous",
    );
  });
});
