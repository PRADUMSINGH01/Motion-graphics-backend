import rateLimit, { RateLimitRequestHandler, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request, Response } from "express";
import client, { getRedisClient, isRedisConfigured } from "../redis/redis.js";

export interface CreateRateLimiterOptions {
  limit?: number;
  windowMs?: number;
  prefix?: string;
  keyGenerator?: (req: Request, res: Response) => string | Promise<string>;
  message?: string | Record<string, any>;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Creates an Express rate limiter middleware.
 * Uses RedisStore when Redis is configured; gracefully falls back to built-in MemoryStore.
 */
export function createRedisRateLimiter(options: CreateRateLimiterOptions = {}): RateLimitRequestHandler {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const limit = options.limit ?? 100;
  const prefix = options.prefix || "rl:";

  let store: any = undefined;

  // Use RedisStore only if Redis is explicitly configured
  if (isRedisConfigured) {
    try {
      store = new RedisStore({
        sendCommand: async (...args: string[]) => {
          const redis = await getRedisClient();
          if (!redis.isOpen) {
            throw new Error("Redis client is not connected");
          }
          return redis.sendCommand(args);
        },
        prefix,
      });
    } catch (err) {
      console.warn("[RateLimiter] Failed to initialize RedisStore, falling back to MemoryStore:", err);
      store = undefined;
    }
  }

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7", // RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: true, // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    validate: { keyGeneratorIpFallback: false },
    store, // undefined gracefully falls back to express-rate-limit MemoryStore
    keyGenerator: options.keyGenerator,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    skipFailedRequests: options.skipFailedRequests,
    handler: (req: Request, res: Response, _next, opts) => {
      const retryAfterSec = Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      res.status(opts.statusCode).json(
        typeof opts.message === "object"
          ? opts.message
          : {
              success: false,
              message: opts.message || "Too many requests. Please try again later.",
              retryAfterSeconds: retryAfterSec,
            }
      );
    },
  });
}

/**
 * RateLimiter class matching existing codebase conventions
 * backed by express-rate-limit and rate-limit-redis.
 */
export class RateLimiter {
  public limit: number;
  public windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Generates express-rate-limit middleware backed by Redis store (or MemoryStore fallback)
   */
  public getMiddleware(
    prefix = "rl:general:",
    keyGenerator?: (req: Request, res: Response) => string | Promise<string>
  ): RateLimitRequestHandler {
    return createRedisRateLimiter({
      limit: this.limit,
      windowMs: this.windowMs,
      prefix,
      keyGenerator,
    });
  }

  public basic_RateLimit(
    prefix = "rl:basic:",
    keyGenerator?: (req: Request, res: Response) => string | Promise<string>
  ): RateLimitRequestHandler {
    return this.getMiddleware(prefix, keyGenerator);
  }

  public SlidingWindow(
    prefix = "rl:sliding:",
    keyGenerator?: (req: Request, res: Response) => string | Promise<string>
  ): RateLimitRequestHandler {
    return this.getMiddleware(prefix, keyGenerator);
  }

  public static getEmailLimiter(limit = 5, windowMs = 60 * 60 * 1000): RateLimiter {
    return new RateLimiter(limit, windowMs);
  }

  public getEmailLimiter(limit = 5, windowMs = 60 * 60 * 1000): RateLimiter {
    return RateLimiter.getEmailLimiter(limit, windowMs);
  }

  public static getIpLimiter(limit = 10, windowMs = 60 * 60 * 1000): RateLimiter {
    return new RateLimiter(limit, windowMs);
  }

  public getIpLimiter(limit = 10, windowMs = 60 * 60 * 1000): RateLimiter {
    return RateLimiter.getIpLimiter(limit, windowMs);
  }
}

// Pre-configured ready-to-use production rate limiter instances
export const authRateLimiter = createRedisRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  prefix: "rl:auth:",
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

export const emailAuthLimiter = createRedisRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  prefix: "rl:email:",
  keyGenerator: (req) => (req.body?.email ? `email:${req.body.email}` : ipKeyGenerator(req.ip || "")),
  message: {
    success: false,
    message: "Too many login attempts for this email address. Please try again in 1 hour.",
  },
});

export const apiRateLimiter = createRedisRateLimiter({
  limit: 120,
  windowMs: 60 * 1000,
  prefix: "rl:api:",
  message: {
    success: false,
    message: "API rate limit exceeded. Please throttle your requests.",
  },
});

export default RateLimiter;