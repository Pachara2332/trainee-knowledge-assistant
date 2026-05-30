import Redis from "ioredis";

const globalForRedis = globalThis as typeof globalThis & {
  rateLimitRedis?: Redis;
};

export function getRateLimitRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    return null;
  }

  if (!globalForRedis.rateLimitRedis) {
    globalForRedis.rateLimitRedis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  return globalForRedis.rateLimitRedis;
}
