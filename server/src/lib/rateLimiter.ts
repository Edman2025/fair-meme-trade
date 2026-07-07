import { createClient, type RedisClientType } from "redis";
import { env } from "../env";

type Bucket = {
  count: number;
  resetAt: number;
};

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

const memoryBuckets = new Map<string, Bucket>();
let redisClientPromise: Promise<RedisClientType | null> | null = null;

const getRedisClient = async () => {
  if (!env.redisUrl) return null;
  if (!redisClientPromise) {
    const client = createClient({ url: env.redisUrl });
    client.on("error", () => {
      // Keep API requests alive if Redis is briefly unavailable; the memory
      // fallback below still protects a single process.
    });
    redisClientPromise = client.connect()
      .then(() => client as RedisClientType)
      .catch(() => {
        redisClientPromise = null;
        return null;
      });
  }
  return redisClientPromise;
};

const assertMemoryRateLimit = (key: string, limit: number, windowMs: number, message: string) => {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new RateLimitError(message);
};

export const assertRateLimit = async (params: {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  message: string;
}) => {
  const bucketKey = `${env.rateLimitPrefix}:${params.namespace}:${params.key}`;
  const client = await getRedisClient();
  if (!client) {
    assertMemoryRateLimit(bucketKey, params.limit, params.windowMs, params.message);
    return;
  }

  try {
    const count = await client.eval(
      "local current=redis.call('INCR',KEYS[1]); if current==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return current",
      { keys: [bucketKey], arguments: [String(params.windowMs)] },
    ) as number;
    if (Number(count) > params.limit) throw new RateLimitError(params.message);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    assertMemoryRateLimit(bucketKey, params.limit, params.windowMs, params.message);
  }
};

export const resetRateLimiterForTests = () => {
  memoryBuckets.clear();
};
