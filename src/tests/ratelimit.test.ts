import "dotenv/config";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import client, { getRedisClient } from "../redis/redis.js";
import RateLimiter, {
  createRedisRateLimiter,
  authRateLimiter,
  emailAuthLimiter,
  apiRateLimiter,
} from "../middleware/RateLimiter.js";

/**
 * Creates mock Express Request and Response objects compatible with express-rate-limit
 */
function createMockHttp(ip = "192.168.1.100", body: Record<string, any> = {}) {
  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, any> = {};
  let nextCalled = false;

  const req = {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
    body,
    method: "POST",
    baseUrl: "",
    path: "/test",
    app: {
      get: (setting: string) => (setting === "trust proxy" ? false : undefined),
    },
  } as unknown as Request;

  const res = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    send(data: any) {
      responseData = data;
      return res;
    },
    setHeader(key: string, value: any) {
      headers[key.toLowerCase()] = value;
      return res;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers,
    wasNextCalled: () => nextCalled,
  };
}

async function runTests() {
  console.log("==================================================");
  console.log(" Testing express-rate-limit + rate-limit-redis");
  console.log("==================================================\n");

  const redis = await getRedisClient();

  // --------------------------------------------------------------------------
  // Test 1: Redis Cloud Connection
  // --------------------------------------------------------------------------
  console.log("[Test 1] Testing Redis Cloud Connection...");
  const ping = await redis.ping();
  assert.equal(ping, "PONG", "Redis client should reply with PONG");
  console.log("✓ Test 1 Passed: Connected to Redis Cloud (PONG).\n");

  // --------------------------------------------------------------------------
  // Test 2: Pre-configured Production Presets
  // --------------------------------------------------------------------------
  console.log("[Test 2] Validating Exported Preset Middlewares...");
  assert.equal(typeof authRateLimiter, "function", "authRateLimiter should be an Express middleware function");
  assert.equal(typeof emailAuthLimiter, "function", "emailAuthLimiter should be an Express middleware function");
  assert.equal(typeof apiRateLimiter, "function", "apiRateLimiter should be an Express middleware function");
  console.log("✓ Test 2 Passed: All preset middlewares successfully initialized with RedisStore.\n");

  // --------------------------------------------------------------------------
  // Test 3: express-rate-limit Enforcement with RedisStore
  // --------------------------------------------------------------------------
  console.log("[Test 3] Testing Rate Limit Enforcement (Limit: 3 in 10s window)...");
  const testPrefix = `test_erl_${Date.now()}:`;
  const testIp = "10.0.0.99";

  const limiter = createRedisRateLimiter({
    limit: 3,
    windowMs: 10 * 1000,
    prefix: testPrefix,
  });

  // Request 1: Allowed
  const r1 = createMockHttp(testIp);
  await limiter(r1.req, r1.res, r1.next);
  assert.equal(r1.wasNextCalled(), true, "Request 1 should be allowed");
  assert.equal(r1.getStatus(), 200);
  assert.equal(Number(r1.getHeaders()["x-ratelimit-remaining"]), 2);

  // Request 2: Allowed
  const r2 = createMockHttp(testIp);
  await limiter(r2.req, r2.res, r2.next);
  assert.equal(r2.wasNextCalled(), true, "Request 2 should be allowed");
  assert.equal(Number(r2.getHeaders()["x-ratelimit-remaining"]), 1);

  // Request 3: Allowed
  const r3 = createMockHttp(testIp);
  await limiter(r3.req, r3.res, r3.next);
  assert.equal(r3.wasNextCalled(), true, "Request 3 should be allowed");
  assert.equal(Number(r3.getHeaders()["x-ratelimit-remaining"]), 0);

  // Request 4: Blocked (429 Too Many Requests)
  const r4 = createMockHttp(testIp);
  await limiter(r4.req, r4.res, r4.next);
  assert.equal(r4.wasNextCalled(), false, "Request 4 should be BLOCKED");
  assert.equal(r4.getStatus(), 429, "Request 4 should return 429 status code");
  assert.ok(r4.getHeaders()["retry-after"] >= 1, "Retry-After header should be present");
  console.log(`  -> Requests 1-3 allowed. Request 4 blocked with 429. Retry-After: ${r4.getHeaders()["retry-after"]}s`);
  console.log("✓ Test 3 Passed: express-rate-limit with RedisStore enforces limits accurately.\n");

  // --------------------------------------------------------------------------
  // Test 4: Custom Key Extraction (Email Rate Limiting)
  // --------------------------------------------------------------------------
  console.log("[Test 4] Testing Custom Key Extraction (Rate Limiting by Email)...");
  const emailPrefix = `test_email_${Date.now()}:`;
  const emailLimiter = createRedisRateLimiter({
    limit: 2,
    windowMs: 10 * 1000,
    prefix: emailPrefix,
    keyGenerator: (req) => (req.body?.email ? `email:${req.body.email}` : "anon"),
  });

  const emailA1 = createMockHttp("192.168.0.1", { email: "userA@studio.com" });
  await emailLimiter(emailA1.req, emailA1.res, emailA1.next);
  assert.equal(emailA1.wasNextCalled(), true);

  const emailA2 = createMockHttp("192.168.0.1", { email: "userA@studio.com" });
  await emailLimiter(emailA2.req, emailA2.res, emailA2.next);
  assert.equal(emailA2.wasNextCalled(), true);

  // 3rd hit for userA -> Blocked
  const emailA3 = createMockHttp("192.168.0.1", { email: "userA@studio.com" });
  await emailLimiter(emailA3.req, emailA3.res, emailA3.next);
  assert.equal(emailA3.wasNextCalled(), false);
  assert.equal(emailA3.getStatus(), 429);

  // userB from same IP -> Allowed
  const emailB1 = createMockHttp("192.168.0.1", { email: "userB@studio.com" });
  await emailLimiter(emailB1.req, emailB1.res, emailB1.next);
  assert.equal(emailB1.wasNextCalled(), true);
  assert.equal(emailB1.getStatus(), 200);
  console.log("  -> userA@studio.com blocked after 2 hits. userB@studio.com from same IP allowed.");
  console.log("✓ Test 4 Passed: Email-based rate limiter isolates quota per account.\n");

  // --------------------------------------------------------------------------
  // Test 5: RateLimiter Class Methods
  // --------------------------------------------------------------------------
  console.log("[Test 5] Testing RateLimiter Class Instance Methods...");
  const classLimiter = new RateLimiter(5, 60000);
  const basicMw = classLimiter.basic_RateLimit("test_class:");
  assert.equal(typeof basicMw, "function", "basic_RateLimit should return middleware");

  const slideMw = classLimiter.SlidingWindow("test_class_slide:");
  assert.equal(typeof slideMw, "function", "SlidingWindow should return middleware");
  console.log("✓ Test 5 Passed: RateLimiter class methods return valid Express middlewares.\n");

  // Cleanup test keys
  const testKeys = await redis.keys("test_*");
  if (testKeys.length > 0) {
    await redis.del(testKeys);
  }

  console.log("==================================================");
  console.log(" 🎉 ALL EXPRESS-RATE-LIMIT TESTS PASSED! ");
  console.log("==================================================");

  await redis.quit();
}

runTests().catch((err) => {
  console.error("❌ Test suite error:", err);
  process.exit(1);
});
