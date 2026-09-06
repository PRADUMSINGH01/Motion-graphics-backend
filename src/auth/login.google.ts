import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { userService } from "../services/user.service.js";
import { auth as firebaseAuth, isFirebaseReady } from "../../firebase/init.js";

const router = Router();

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

function getRedirectUri(req: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  const host = req.get("host") || "localhost:3001";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}/api/google/callback`;
}

function getOAuth2Client(req: Request): OAuth2Client {
  return new OAuth2Client(clientId, clientSecret, getRedirectUri(req));
}

function packState(stateObj: Record<string, any>): string {
  return Buffer.from(JSON.stringify(stateObj)).toString("base64url");
}

function unpackState(stateStr?: string): Record<string, any> {
  if (!stateStr) return {};
  try {
    return JSON.parse(Buffer.from(stateStr, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function getFrontendUrl(req: Request, state?: Record<string, any>): string {
  if (state?.origin && typeof state.origin === "string") {
    return state.origin.replace(/\/$/, "");
  }
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

interface PopupResponseData {
  success: boolean;
  token?: string;
  user?: any;
  isNewUser?: boolean;
  error?: string;
  frontendBase: string;
}

function renderPopupResponse(res: Response, data: PopupResponseData): void {
  const payload = data.success
    ? {
        type: "GOOGLE_AUTH_SUCCESS",
        token: data.token,
        user: data.user,
        isNewUser: data.isNewUser ?? false,
      }
    : {
        type: "GOOGLE_AUTH_ERROR",
        message: data.error || "Google authentication failed.",
      };

  const statusTitle = data.success ? "Authentication Successful" : "Authentication Notice";
  const statusDesc = data.success
    ? `Welcome back, ${data.user?.profile?.displayName || "Creator"}! Returning to Animagent Studio...`
    : (data.error || "Could not complete authentication. You can close this window.");
  const iconColor = data.success ? "#22c55e" : "#ef4444";
  const iconSvg = data.success
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle} - Animagent AI</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #090a0f;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-sizing: border-box;
      user-select: none;
    }
    .card {
      background: #12131a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .icon-box {
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
    }
    p {
      margin: 0 0 20px 0;
      font-size: 13px;
      line-height: 1.5;
      color: #94a3b8;
    }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top-color: #22d3ee;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    button {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.14);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">${iconSvg}</div>
    ${data.success ? '<div class="spinner"></div>' : ''}
    <h2>${statusTitle}</h2>
    <p>${statusDesc}</p>
    <button onclick="window.close()">Close Window</button>
  </div>

  <script>
    (function() {
      var payload = ${JSON.stringify(payload)};
      var targetOrigin = ${JSON.stringify(data.frontendBase || "*")};

      function dispatch() {
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, targetOrigin);
          } catch(e) {
            try { window.opener.postMessage(payload, "*"); } catch(err) {}
          }
        }
      }

      dispatch();

      setTimeout(function() {
        dispatch();
        window.close();
      }, ${data.success ? 400 : 1500});
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

/**
 * GET /api/google/url
 * Returns the Google authorization URL for frontend navigation.
 */
router.get("/url", (req: Request, res: Response) => {
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      success: false,
      message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured on the server.",
    });
  }

  const origin = (req.query.origin as string) || (req.headers.origin as string) || undefined;
  const mode = (req.query.mode as string) || "login";
  const plan = (req.query.plan as string) || "free";
  const popup = req.query.popup === "true" || req.query.popup === "1";

  const state = packState({ origin, mode, plan, popup });
  const oauth2 = getOAuth2Client(req);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    prompt: "select_account",
    state,
  });

  return res.status(200).json({
    success: true,
    url: authUrl,
  });
});

/**
 * GET /api/google/auth
 * Directly redirects the browser to the Google OAuth 2.0 authorization screen.
 */
router.get("/auth", (req: Request, res: Response) => {
  if (!clientId || !clientSecret) {
    return res.status(500).send("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured on the server.");
  }

  const origin = (req.query.origin as string) || (req.headers.origin as string) || undefined;
  const mode = (req.query.mode as string) || "login";
  const plan = (req.query.plan as string) || "free";
  const popup = req.query.popup === "true" || req.query.popup === "1";

  const state = packState({ origin, mode, plan, popup });
  const oauth2 = getOAuth2Client(req);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    prompt: "select_account",
    state,
  });

  return res.redirect(authUrl);
});

/**
 * GET /api/google/callback
 * Handles Google OAuth redirect with authorization code, syncs user, and redirects back to frontend.
 */
router.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const errorParam = req.query.error as string | undefined;
  const rawState = req.query.state as string | undefined;
  const state = unpackState(rawState);
  const isPopup = Boolean(state?.popup);
  const frontendBase = getFrontendUrl(req, state);

  if (errorParam) {
    console.warn("[GoogleOAuth] Authorization denied by user or Google error:", errorParam);
    if (isPopup) {
      return renderPopupResponse(res, {
        success: false,
        error: `Google authentication was cancelled: ${errorParam}`,
        frontendBase,
      });
    }
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent(`Google authentication was cancelled: ${errorParam}`)}`);
  }

  if (!code) {
    if (isPopup) {
      return renderPopupResponse(res, {
        success: false,
        error: "Missing authorization code from Google.",
        frontendBase,
      });
    }
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent("Missing authorization code from Google.")}`);
  }

  try {
    const oauth2 = getOAuth2Client(req);
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    let profile: {
      id: string;
      email: string;
      name: string;
      picture?: string | null;
      emailVerified?: boolean;
    } | null = null;

    // 1. Extract profile from ID token
    if (tokens.id_token) {
      try {
        const ticket = await oauth2.verifyIdToken({
          idToken: tokens.id_token,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        if (payload?.email) {
          profile = {
            id: payload.sub,
            email: payload.email.toLowerCase(),
            name: payload.name || payload.email.split("@")[0],
            picture: payload.picture || null,
            emailVerified: payload.email_verified ?? true,
          };
        }
      } catch (idErr) {
        console.warn("[GoogleOAuth] verifyIdToken failed, falling back to userinfo:", idErr);
      }
    }

    // 2. Fallback: Fetch userinfo endpoint using access token
    if (!profile && tokens.access_token) {
      const userinfoRes = await oauth2.request<{
        sub: string;
        email: string;
        name?: string;
        picture?: string;
        email_verified?: boolean;
      }>({
        url: "https://www.googleapis.com/oauth2/v3/userinfo",
      });

      if (userinfoRes.data?.email) {
        profile = {
          id: userinfoRes.data.sub,
          email: userinfoRes.data.email.toLowerCase(),
          name: userinfoRes.data.name || userinfoRes.data.email.split("@")[0],
          picture: userinfoRes.data.picture || null,
          emailVerified: userinfoRes.data.email_verified ?? true,
        };
      }
    }

    if (!profile) {
      throw new Error("Unable to retrieve user profile from Google.");
    }

    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || undefined;
    const userAgent = req.headers["user-agent"] || undefined;

    // Sync Google user with Firebase Realtime Database
    const { user, publicUser, isNewUser } = await userService.syncGoogleUser(profile, {
      ip,
      userAgent,
      plan: state?.plan,
    });

    // Set secure HttpOnly session cookie
    res.cookie("token", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    if (isPopup) {
      return renderPopupResponse(res, {
        success: true,
        token: user.id,
        user: publicUser,
        isNewUser,
        frontendBase,
      });
    }

    // Redirect to frontend auth callback handler
    const targetUrl = `${frontendBase}/auth/callback?token=${encodeURIComponent(user.id)}&name=${encodeURIComponent(publicUser.profile.displayName)}&newUser=${isNewUser}`;
    return res.redirect(targetUrl);
  } catch (err: any) {
    console.error("[GoogleOAuth] Callback processing failed:", err);
    if (isPopup) {
      return renderPopupResponse(res, {
        success: false,
        error: err?.message || "Google authentication failed.",
        frontendBase,
      });
    }
    return res.redirect(`${frontendBase}/login?error=${encodeURIComponent(err?.message || "Google authentication failed.")}`);
  }
});

/**
 * POST /api/google
 * Programmatic endpoint: accepts either authorization code { code } or credential { credential }
 */
const programmaticSchema = z.object({
  code: z.string().optional(),
  credential: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = programmaticSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.code && !parsed.data.credential)) {
      return res.status(400).json({
        success: false,
        message: "Either authorization 'code' or 'credential' must be provided.",
      });
    }

    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || undefined;
    const userAgent = req.headers["user-agent"] || undefined;
    let profile: { id: string; email: string; name: string; picture?: string | null; emailVerified?: boolean } | null = null;

    // Case 1: Server-side authorization code exchange
    if (parsed.data.code) {
      const oauth2 = getOAuth2Client(req);
      const { tokens } = await oauth2.getToken(parsed.data.code);
      oauth2.setCredentials(tokens);

      if (tokens.id_token) {
        const ticket = await oauth2.verifyIdToken({
          idToken: tokens.id_token,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        if (payload?.email) {
          profile = {
            id: payload.sub,
            email: payload.email.toLowerCase(),
            name: payload.name || payload.email.split("@")[0],
            picture: payload.picture || null,
            emailVerified: payload.email_verified ?? true,
          };
        }
      }
    }

    // Case 2: Direct credential token (JWT ID token)
    if (!profile && parsed.data.credential) {
      const cred = parsed.data.credential;
      if (clientId) {
        try {
          const oauth2 = new OAuth2Client(clientId);
          const ticket = await oauth2.verifyIdToken({
            idToken: cred,
            audience: clientId,
          });
          const payload = ticket.getPayload();
          if (payload?.email) {
            profile = {
              id: payload.sub,
              email: payload.email.toLowerCase(),
              name: payload.name || payload.email.split("@")[0],
              picture: payload.picture || null,
              emailVerified: payload.email_verified ?? false,
            };
          }
        } catch {
          // fallback
        }
      }

      if (!profile && isFirebaseReady()) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(cred);
          if (decoded?.email) {
            profile = {
              id: decoded.uid,
              email: decoded.email.toLowerCase(),
              name: decoded.name || decoded.email.split("@")[0],
              picture: decoded.picture || null,
              emailVerified: decoded.email_verified ?? true,
            };
          }
        } catch {
          // fallback
        }
      }

      if (!profile && cred.includes(".")) {
        const parts = cred.split(".");
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
          if (payload?.email) {
            profile = {
              id: payload.sub || payload.user_id || payload.uid || `google_${Date.now()}`,
              email: payload.email.toLowerCase(),
              name: payload.name || payload.email.split("@")[0],
              picture: payload.picture || null,
              emailVerified: Boolean(payload.email_verified),
            };
          }
        }
      }
    }

    if (!profile) {
      throw new Error("Unable to verify Google credentials.");
    }

    const { user, publicUser, isNewUser } = await userService.syncGoogleUser(profile, { ip, userAgent });

    res.cookie("token", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? "Google user registered and logged in." : "Google login successful.",
      user: publicUser,
      token: user.id,
    });
  } catch (err: any) {
    console.error("[GoogleLogin] Programmatic error:", err);
    return res.status(401).json({
      success: false,
      message: err?.message || "Google authentication failed.",
    });
  }
});

/**
 * GET /api/google
 * If accessed directly via browser, initiates Google OAuth flow.
 */
router.get("/", (req: Request, res: Response) => {
  const acceptsHtml = req.headers.accept?.includes("text/html");
  if (acceptsHtml) {
    return res.redirect("/api/google/auth");
  }
  return res.status(200).json({
    success: true,
    message: "Google OAuth 2.0 endpoint active. Use GET /api/google/auth or GET /api/google/url to initiate.",
    endpoints: {
      auth: "/api/google/auth",
      url: "/api/google/url",
      callback: "/api/google/callback",
    },
  });
});

export default router;
