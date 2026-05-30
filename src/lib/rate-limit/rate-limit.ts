type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

const buckets = new Map<string, Bucket>();

const INCR_WITH_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

function redisKey(key: string) {
  return `rl:${key}`;
}

function checkMemoryRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

async function checkRedisRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  if (!process.env.REDIS_URL?.trim()) {
    return null;
  }

  const { getRateLimitRedisClient } = await import("./redis-client");
  const client = getRateLimitRedisClient();

  if (!client) {
    return null;
  }

  try {
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    }

    const result = (await client.eval(
      INCR_WITH_TTL_SCRIPT,
      1,
      redisKey(key),
      String(windowMs),
    )) as [number, number];
    const count = Number(result[0]);
    const ttlMs = Math.max(0, Number(result[1]));

    if (count > limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }

    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, falling back to memory", error);
    return null;
  }
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const redisResult = await checkRedisRateLimit({ key, limit, windowMs });

  if (redisResult) {
    return redisResult;
  }

  return checkMemoryRateLimit({ key, limit, windowMs });
}

export function resetMemoryRateLimitForTests() {
  buckets.clear();
}
