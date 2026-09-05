import { Queue } from "bullmq";
import { redisConnection } from "../src/redis/redis.js";

export const EMAiLQUEUE = new Queue("email", {
    connection: redisConnection,
});

export const AGENTQUEUE = new Queue("AGENT", {
    connection: redisConnection,
});

const QueueStack = {
    EMAiLQUEUE,
    AGENTQUEUE,
};

export default QueueStack;