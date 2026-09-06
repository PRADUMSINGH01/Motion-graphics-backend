import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { userService } from "../services/user.service.js";
import { CreateApiKeyDtoSchema } from "../schemas/user.schema.js";

const router = Router();

// All routes require authenticated user
router.use(requireAuth);

/**
 * GET /api/keys
 * Lists all API keys belonging to the authenticated user.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.rawUserId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const keys = await userService.listApiKeys(userId);
    return res.status(200).json({
      success: true,
      keys,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list API keys.";
    return res.status(500).json({ success: false, message });
  }
});

/**
 * POST /api/keys
 * Generates a new cryptographically secure API secret key.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.rawUserId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const parseResult = CreateApiKeyDtoSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid API key creation request.",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const result = await userService.createApiKey(userId, parseResult.data);

    return res.status(201).json({
      success: true,
      message: "API Key created successfully. Store this secret key securely, it will not be shown again.",
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        prefix: result.apiKey.prefix,
        environment: result.apiKey.environment,
        scopes: result.apiKey.scopes,
        rateLimitPerMinute: result.apiKey.rateLimitPerMinute,
        status: result.apiKey.status,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt,
      },
      secretKey: result.secretKey,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create API key.";
    return res.status(400).json({ success: false, message });
  }
});

/**
 * DELETE /api/keys/:id
 * Revokes an existing API key.
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.rawUserId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const rawId = req.params.id;
    const keyId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!keyId) {
      return res.status(400).json({ success: false, message: "Key ID is required." });
    }

    const revoked = await userService.revokeApiKey(userId, keyId);
    if (!revoked) {
      return res.status(404).json({ success: false, message: "Key not found or already revoked." });
    }

    return res.status(200).json({
      success: true,
      message: "API Key revoked successfully.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to revoke API key.";
    return res.status(500).json({ success: false, message });
  }
});

export default router;
