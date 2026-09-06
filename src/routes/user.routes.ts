import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { userService } from "../services/user.service.js";
import { PlanTierSchema, BillingIntervalSchema } from "../schemas/user.schema.js";
import { z } from "zod";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/user/me
 * Retrieves current authenticated user's profile and plan.
 */
router.get("/me", async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

const updatePlanSchema = z.object({
  tier: PlanTierSchema,
  interval: BillingIntervalSchema.optional().default("monthly"),
});

/**
 * POST /api/user/plan
 * Upgrades or modifies subscription tier.
 */
router.post("/plan", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.rawUserId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan update request.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const updatedUser = await userService.updatePlan(
      userId,
      parsed.data.tier,
      parsed.data.interval
    );

    return res.status(200).json({
      success: true,
      message: `Plan successfully updated to ${parsed.data.tier}.`,
      user: updatedUser,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update plan.";
    return res.status(400).json({ success: false, message });
  }
});

export default router;
