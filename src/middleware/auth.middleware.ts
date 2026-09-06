import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service.js";
import { PublicUser, ApiKeyRecord, toPublicUser } from "../schemas/user.schema.js";

// Extend Express Request interface to include authenticated user and apiKey
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      rawUserId?: string;
      apiKey?: ApiKeyRecord;
    }
  }
}

/**
 * Universal authentication middleware.
 * Supports:
 * 1. Bearer API key (anim_live_... or anim_test_...)
 * 2. Header `x-api-key`
 * 3. Bearer session / User ID token
 * 4. HttpOnly cookie token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]?.trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    } else if ((req as any).cookies?.token) {
      token = (req as any).cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication credentials were not provided in Authorization header or cookies.",
      });
    }

    // Case 1: Developer API Key
    if (token.startsWith("anim_live_") || token.startsWith("anim_test_")) {
      const authResult = await userService.findByApiKey(token);
      if (!authResult) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Invalid or revoked API key.",
        });
      }

      req.user = toPublicUser(authResult.user);
      req.rawUserId = authResult.user.id;
      req.apiKey = authResult.apiKey;
      return next();
    }

    // Case 2: User ID token or session token
    const user = await userService.findById(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid session or user not found.",
      });
    }

    if (user.auth.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Account is ${user.auth.status}.`,
      });
    }

    req.user = toPublicUser(user);
    req.rawUserId = user.id;
    return next();
  } catch (err) {
    console.error("[AuthMiddleware] Error verifying authentication:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "An error occurred while verifying credentials.",
    });
  }
}

/**
 * Enforces role-based access control (RBAC).
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required.",
      });
    }

    const userRole = req.user.auth.role;
    if (userRole === "superadmin" || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: `Access denied. Required roles: ${allowedRoles.join(", ")}. Your role: ${userRole}`,
    });
  };
}

/**
 * Enforces specific API key scopes (e.g. 'render:create').
 */
export function requireApiKeyScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      // If request is authenticated via dashboard user session, allow access
      if (req.user) return next();

      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "API Key required for this endpoint.",
      });
    }

    const scopes = req.apiKey.scopes || [];
    if (scopes.includes("*") || scopes.includes(requiredScope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: `API Key lacks the required scope: '${requiredScope}'.`,
    });
  };
}
