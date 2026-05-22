import { describe, expect, it } from "vitest";
import { parseSseEvents } from "./sse-events";

describe("parseSseEvents", () => {
  it("parses complete server-sent events and keeps the partial tail", () => {
    const parsed = parseSseEvents(
      'event: token\ndata: {"text":"Hi"}\n\n' +
        'event: usage\ndata: {"totalTokens":3}\n\n' +
        "event: token\ndata:",
    );

    expect(parsed.events).toEqual([
      { name: "token", data: '{"text":"Hi"}' },
      { name: "usage", data: '{"totalTokens":3}' },
    ]);
    expect(parsed.rest).toBe("event: token\ndata:");
  });

  it("defaults unnamed events to message", () => {
    expect(parseSseEvents("data: hello\n\n").events).toEqual([
      { name: "message", data: "hello" },
    ]);
  });
});
