import { Router , Request , Response } from "express";
import z from "zod";
import { AGENTJOBS } from "../../worker/jobs.js";


const router = Router();

const PromptRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt cannot be empty"),
    userId: z.string().min(1, "User ID cannot be empty"),
    promptId: z.string().min(1, "Prompt ID cannot be empty"),
    template: z.string().optional(),
});



interface PromptRequest {
    prompt: string,
    userId: string,
    promptId: string,
}

router.post("/", async (req:Request, res:Response)=>{
    try {
        const { prompt, userId, promptId } = req.body || {};
        const result = PromptRequestSchema.safeParse({ prompt, userId, promptId });
        if (!result.success) {
            return res.status(400).json({ error: result.error.message });
        }

        let promptJob: any = null;
        try {
            promptJob = await AGENTJOBS.add("agent", {
                prompt,
                userId,
                promptId
            });
        } catch (queueErr) {
            console.warn("[Prompt] BullMQ queue add warning (proceeding with motion synthesis):", queueErr);
            promptJob = {
                id: `job-${Date.now()}`,
                name: "agent",
                data: { prompt, userId, promptId }
            };
        }

        // Procedural Motion Metadata for client canvas preview
        const lower = prompt.toLowerCase();
        let detectedStyle = "Kinetic Typography";
        if (lower.includes("3d") || lower.includes("cube") || lower.includes("isometric") || lower.includes("prism")) {
            detectedStyle = "3D Isometric";
        } else if (lower.includes("logo") || lower.includes("reveal") || lower.includes("badge") || lower.includes("emblem") || lower.includes("brand")) {
            detectedStyle = "Logo Reveal";
        } else if (lower.includes("vfx") || lower.includes("plasma") || lower.includes("abstract") || lower.includes("fluid") || lower.includes("liquid") || lower.includes("smoke")) {
            detectedStyle = "Abstract VFX";
        } else if (lower.includes("ui") || lower.includes("lottie") || lower.includes("audio") || lower.includes("equalizer") || lower.includes("sound") || lower.includes("bars")) {
            detectedStyle = "UI & Lottie";
        }

        let detectedPalette = "cyan";
        if (lower.includes("purple") || lower.includes("violet") || lower.includes("magenta") || lower.includes("pink")) {
            detectedPalette = "purple";
        } else if (lower.includes("amber") || lower.includes("gold") || lower.includes("yellow") || lower.includes("solar") || lower.includes("orange")) {
            detectedPalette = "amber";
        } else if (lower.includes("matrix") || lower.includes("emerald") || lower.includes("green")) {
            detectedPalette = "matrix";
        } else if (lower.includes("crimson") || lower.includes("flame") || lower.includes("fire") || lower.includes("ruby") || lower.includes("red")) {
            detectedPalette = "crimson";
        } else if (lower.includes("blue") || lower.includes("ocean") || lower.includes("sky")) {
            detectedPalette = "blue";
        }

        let renderedText = "";
        const quoteMatch = prompt.match(/["']([^"']{1,32})["']/);
        if (quoteMatch && quoteMatch[1]?.trim()) {
            renderedText = quoteMatch[1].trim().toUpperCase();
        } else {
            const kwMatch = prompt.match(/\b(?:text|title|word|for|brand|named|saying):\s*([a-zA-Z0-9_-]{1,32})\b/i);
            if (kwMatch && kwMatch[1]?.trim()) {
                renderedText = kwMatch[1].trim().toUpperCase();
            } else {
                renderedText = prompt.trim().toUpperCase().slice(0, 24);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Prompt added to queue successfully",
            job: {
                id: promptJob.id,
                name: promptJob.name,
                data: promptJob.data,
            },
            motion: {
                promptId,
                prompt,
                renderedText,
                style: detectedStyle,
                palette: detectedPalette,
                fps: 60,
                duration: 5,
                status: "ready"
            }
        });

    } catch (err) {
        console.error("[Prompt] Error adding prompt to queue:", err);
        return res.status(500).json({ error: "Failed to queue prompt request" });
    }
}); 


export default router;