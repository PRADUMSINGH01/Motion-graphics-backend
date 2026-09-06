import { Worker } from "bullmq";
import { redisConnection } from "../src/redis/redis.js";
import { loginemailer } from "../src/emails/login.email.js";
import { registeremailer } from "../src/emails/register.email.js";
import { resetemailer } from "../src/emails/reset.email.js";

export const EMAiLWORKER = new Worker(
    "email",
    async (job) => {
        console.log(`[Worker] Processing job ${job.id} of type: ${job.name}`);
        const { to, name = "Motion Creator", resetUrl, ...details } = job.data || {};

        if (!to) {
            console.warn(`[Worker] Job ${job.id} has no recipient 'to' address.`);
            return;
        }

        switch (job.name) {
            case "login":
                return await loginemailer(name, to, details);
            case "register":
                return await registeremailer(name, to, details);
            case "forget":
            case "reset":
                return await resetemailer(
                    name, 
                    to, 
                    resetUrl || "https://motion.dev/reset-password", 
                    details
                );
            default:
                console.log(`[Worker] Unhandled job type '${job.name}'`);
        }
    },
    {
        connection: redisConnection,
    }
);

EMAiLWORKER.on("completed", (job) => {
    console.log(`Job ${job.id} (${job.name}) completed successfully`);
});

EMAiLWORKER.on("failed", (job, err) => {
    console.error(`Job ${job?.id} (${job?.name}) failed:`, err);
});



export const AGENTWORKER = new Worker(
    "agent",
    async (job) => {
        console.log(`[AgentWorker] Processing job ${job.id} of type: ${job.name}`);
        const { prompt, userId, promptId } = job.data || {};

        console.log(`[AgentWorker] Executing prompt motion task for User: ${userId}, PromptId: ${promptId}`);
        console.log(`[AgentWorker] Prompt: "${prompt}"`);

        // Return processed job payload
        return {
            status: "success",
            jobId: job.id,
            userId,
            promptId,
            prompt,
            processedAt: new Date().toISOString(),
        };
    },
    {
        connection: redisConnection,
    }
);

AGENTWORKER.on("completed", (job, result) => {
    console.log(`[AgentWorker] Job ${job.id} (${job.name}) completed successfully:`, result);
});

AGENTWORKER.on("failed", (job, err) => {
    console.error(`[AgentWorker] Job ${job?.id} (${job?.name}) failed:`, err);
});