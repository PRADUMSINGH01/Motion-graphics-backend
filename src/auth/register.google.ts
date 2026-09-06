import { Router, type Request, type Response } from "express";
import loginGoogleRouter from "./login.google.js";

const router = Router();

/**
 * GET /api/google/register
 * Initiates Google OAuth with mode=register
 */
router.get("/", (req: Request, res: Response) => {
  const acceptsHtml = req.headers.accept?.includes("text/html");
  const plan = (req.query.plan as string) || "free";
  const origin = (req.query.origin as string) || "";
  const popup = (req.query.popup as string) || "";
  const queryParams: Record<string, string> = { mode: "register", plan, origin };
  if (popup) queryParams.popup = popup;
  const query = new URLSearchParams(queryParams).toString();

  if (acceptsHtml) {
    return res.redirect(`/api/google/auth?${query}`);
  }
  return res.redirect(`/api/google/url?${query}`);
});

/**
 * POST /api/google/register
 * Programmatic registration route forwarding to main handler
 */
router.post("/", (req: Request, res: Response, next) => {
  return (loginGoogleRouter as any)(req, res, next);
});

export default router;
