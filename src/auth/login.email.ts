import { Router, type Request, type Response } from "express";
import { userService } from "../services/user.service.js";
import { LoginEmailDtoSchema } from "../schemas/user.schema.js";
import { EMAiLQUEUE } from "../../worker/queue.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = LoginEmailDtoSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid login credentials provided.",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parseResult.data;
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || undefined;
    const userAgent = req.headers["user-agent"] || undefined;

    const { user, publicUser } = await userService.authenticateWithEmail(
      { email, password },
      { ip, userAgent }
    );

    // Queue login notification email in background
    try {
      await EMAiLQUEUE.add("login", {
        to: user.email,
        name: user.profile.displayName,
        device: userAgent || "Unknown Device",
        ipAddress: ip || "Unknown IP",
        location: "Detected Session",
      });
    } catch (queueErr) {
      console.warn("[Login] Failed to queue login alert email:", queueErr);
    }

    res.cookie("token", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: publicUser,
      token: user.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    console.error("[Login] Authentication error:", error);

    return res.status(401).json({
      success: false,
      message,
    });
  }
});

router.get("/", (_req: Request, res: Response) => {
  return res.status(405).json({
    success: false,
    message: "Method not allowed. Use POST with email and password.",
  });
});

export default router;