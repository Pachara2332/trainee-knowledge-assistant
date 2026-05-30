import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetMemoryRateLimitForTests } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "");
    resetMemoryRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const key = `u-${Math.random()}`;
    await expect(checkRateLimit({ key, limit: 3, windowMs: 10_000 })).resolves.toMatchObject({ allowed: true });
    await expect(checkRateLimit({ key, limit: 3, windowMs: 10_000 })).resolves.toMatchObject({ allowed: true });
  });

  it("blocks after the limit and reports retry window", async () => {
    const key = `b-${Math.random()}`;
    expect((await checkRateLimit({ key, limit: 2, windowMs: 5000 })).allowed).toBe(true);
    expect((await checkRateLimit({ key, limit: 2, windowMs: 5000 })).allowed).toBe(true);
    const blocked = await checkRateLimit({ key, limit: 2, windowMs: 5000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window passes", async () => {
    const key = `r-${Math.random()}`;
    expect((await checkRateLimit({ key, limit: 1, windowMs: 1000 })).allowed).toBe(true);
    expect((await checkRateLimit({ key, limit: 1, windowMs: 1000 })).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await checkRateLimit({ key, limit: 1, windowMs: 1000 })).allowed).toBe(true);
  });
});
