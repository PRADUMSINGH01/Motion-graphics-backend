import { Router } from "express";

import login from "../auth/login.email.js";
import register from "../auth/register.email.js";
import googleLogin from "../auth/login.google.js";
import googleRegister from "../auth/register.google.js";
import keysRouter from "./keys.routes.js";
import userRouter from "./user.routes.js";

const router = Router();

// Authentication endpoints
router.use("/login", login);
router.use("/register", register);
router.use("/google", googleLogin);
router.use("/google/register", googleRegister);
router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.status(200).json({ success: true, message: "Logged out successfully." });
});

// User & Developer endpoints
router.use("/user", userRouter);
router.use("/keys", keysRouter);

export default router;