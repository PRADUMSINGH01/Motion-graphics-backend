import { Queue } from "bullmq";
import { redisConnection } from "../src/redis/redis.js";

export const EMAiLQUEUE = new Queue("email", {
    connection: redisConnection,
});

export const AGENTQUEUE = new Queue("agent", {
    connection: redisConnection,
});

// Non-fatal error handlers so BullMQ connection errors never crash the Node.js process
EMAiLQUEUE.on("error", (err) => {
    console.warn("[BullMQ] EMAiLQUEUE connection warning (non-fatal):", err?.message || err);
});

AGENTQUEUE.on("error", (err) => {
    console.warn("[BullMQ] AGENTQUEUE connection warning (non-fatal):", err?.message || err);
});

const QueueStack = {
    EMAiLQUEUE,
    AGENTQUEUE,
};

export default QueueStack;