import { Router } from "express";
import login from "../auth/login.email.js";
import register from "../auth/register.email.js";
import googleLogin from "../auth/login.google.js";
import googleRegister from "../auth/register.google.js";
import keysRouter from "./keys.routes.js";
import userRouter from "./user.routes.js";
import { authRateLimiter, emailAuthLimiter } from "../middleware/RateLimiter.js";

const router = Router();

// Strict: 10 attempts per 15m (IP) and 5 attempts per hour (per email)
router.use("/login", authRateLimiter, emailAuthLimiter, login);
router.use("/register", authRateLimiter, register);
router.use("/google", authRateLimiter, googleLogin);
router.use("/google/register", authRateLimiter, googleRegister);

router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.status(200).json({ success: true, message: "Logged out successfully." });
});

// User & developer endpoints (governed by the global 120/min limit)
router.use("/user", userRouter);
router.use("/keys", keysRouter);

export default router;
