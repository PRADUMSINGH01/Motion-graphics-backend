import { createClient } from "redis";

// Check whether Redis is explicitly configured in the environment
export const isRedisConfigured = Boolean(
  process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_HOST !== "127.0.0.1")
);

export const redisConnection = {
  username: process.env.REDIS_USER || undefined,
  password: process.env.REDIS_PASS || undefined,
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const redisUrl = process.env.REDIS_URL;

const client = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10 && !isRedisConfigured) return false;
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 5000,
      },
    })
  : createClient({
      username: redisConnection.username,
      password: redisConnection.password,
      socket: {
        host: redisConnection.host,
        port: redisConnection.port,
        reconnectStrategy: (retries) => {
          if (retries > 5 && !isRedisConfigured) return false;
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 5000,
      },
    });

// Non-fatal error listener to prevent Node.js unhandled error crashes
client.on("error", (err) => {
  console.warn("[Redis Client Error] (non-fatal):", err?.message || err);
});

let isConnecting = false;

/**
 * Ensures the Redis client is connected before executing commands.
 */
export async function getRedisClient() {
  if (!client.isOpen && !isConnecting && isRedisConfigured) {
    isConnecting = true;
    try {
      await client.connect();
    } catch (err: any) {
      console.warn("[Redis] Could not connect to Redis (non-fatal):", err?.message || err);
    } finally {
      isConnecting = false;
    }
  }
  return client;
}

// Auto-connect in background on module load only if explicitly configured
if (isRedisConfigured && !client.isOpen) {
  client.connect().catch((err) => {
    console.warn("[Redis] Background connection error (non-fatal):", err?.message || err);
  });
}

export default client;
