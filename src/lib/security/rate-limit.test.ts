import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = `u-${Math.random()}`;
    expect(checkRateLimit({ key, limit: 3, windowMs: 10_000 }).allowed).toBe(true);
    expect(checkRateLimit({ key, limit: 3, windowMs: 10_000 }).allowed).toBe(true);
  });

  it("blocks after the limit and reports retry window", () => {
    const key = `b-${Math.random()}`;
    expect(checkRateLimit({ key, limit: 2, windowMs: 5000 }).allowed).toBe(true);
    expect(checkRateLimit({ key, limit: 2, windowMs: 5000 }).allowed).toBe(true);
    const blocked = checkRateLimit({ key, limit: 2, windowMs: 5000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window passes", () => {
    const key = `r-${Math.random()}`;
    expect(checkRateLimit({ key, limit: 1, windowMs: 1000 }).allowed).toBe(true);
    expect(checkRateLimit({ key, limit: 1, windowMs: 1000 }).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit({ key, limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });
});
