import { Router, Request, Response } from "express";
import { z } from "zod";
import { userService } from "../services/user.service.js";
import { CreateEmailUserDtoSchema } from "../schemas/user.schema.js";
import { EMAiLQUEUE } from "../../worker/queue.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = CreateEmailUserDtoSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration payload.",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email, password, name, username, plan } = parseResult.data;
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || undefined;
    const userAgent = req.headers["user-agent"] || undefined;

    const { user, publicUser } = await userService.createUserWithEmail(
      {
        email,
        password,
        name,
        username,
        plan,
      },
      { ip, userAgent }
    );

    // Queue welcome email in background (non-blocking)
    try {
      await EMAiLQUEUE.add("register", {
        to: user.email,
        name: user.profile.displayName,
        dashboardUrl: process.env.FRONTEND_URL || "https://motion.dev/dashboard",
      });
    } catch (queueErr) {
      console.warn("[Register] Failed to queue welcome email:", queueErr);
    }

    res.cookie("token", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: publicUser,
      token: user.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    console.error("[Register] Error:", error);

    const statusCode = message.includes("already exists") ? 409 : 500;
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
});

router.get("/", (_req: Request, res: Response) => {
  return res.status(405).json({
    success: false,
    message: "Method not allowed. Use POST to register a new user.",
  });
});

export default router;