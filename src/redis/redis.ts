import { createClient } from "redis";

export const redisConnection = {
  username: process.env.REDIS_USER || undefined,
  password: process.env.REDIS_PASS || undefined,
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const redisUrl = process.env.REDIS_URL;

const client = redisUrl
  ? createClient({ url: redisUrl })
  : createClient({
      username: redisConnection.username,
      password: redisConnection.password,
      socket: {
        host: redisConnection.host,
        port: redisConnection.port,
      },
    });

client.on("error", (err) => {
  console.error("[Redis Client Error]", err?.message || err);
});

let isConnecting = false;

/**
 * Ensures the Redis client is connected before executing commands.
 */
export async function getRedisClient() {
  if (!client.isOpen && !isConnecting) {
    isConnecting = true;
    try {
      await client.connect();
    } catch (err: any) {
      console.warn("[Redis] Could not connect to Redis:", err?.message || err);
    } finally {
      isConnecting = false;
    }
  }
  return client;
}

// Auto-connect in background on module load
if (!client.isOpen) {
  client.connect().catch((err) => {
    console.warn("[Redis] Background connection error:", err?.message || err);
  });
}

export default client;
