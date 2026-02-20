import type { ConnectionOptions } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    maxRetriesPerRequest: null,
  };
}

/**
 * Returns Redis connection options for BullMQ.
 * BullMQ manages its own connections internally.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  return parseRedisUrl(REDIS_URL);
}
