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
