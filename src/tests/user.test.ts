import assert from "node:assert/strict";
import {
  UserRecordSchema,
  buildDefaultUser,
  toPublicUser,
  PLAN_CONFIGS,
  hasExceededGenerations,
} from "../schemas/user.schema.js";
import { userService } from "../services/user.service.js";

async function runTests() {
  console.log("==================================================");
  console.log(" Starting Central User Schema & Service Test Suite");
  console.log("==================================================\n");

  userService.resetLocalStore();

  // --------------------------------------------------------------------------
  // Test 1: Schema Validation & Factory Defaults
  // --------------------------------------------------------------------------
  console.log("[Test 1] Validating buildDefaultUser and UserRecordSchema...");
  const sampleUser = buildDefaultUser({
    id: "usr_test_12345",
    email: "designer@animagent.dev",
    name: "Alex Rivera",
    provider: "email",
    plan: "free",
  });

  const parsed = UserRecordSchema.safeParse(sampleUser);
  assert.equal(parsed.success, true, "UserRecord should pass schema validation");
  assert.equal(sampleUser.profile.displayName, "Alex Rivera");
  assert.equal(sampleUser.profile.firstName, "Alex");
  assert.equal(sampleUser.profile.lastName, "Rivera");
  assert.equal(sampleUser.plan.tier, "free");
  assert.equal(sampleUser.usage.generations.limit, PLAN_CONFIGS.free.generationsPerMonth);
  assert.equal(sampleUser.settings.theme, "dark");
  console.log("✓ Test 1 Passed: Default schema values and quotas correctly generated.\n");

  // --------------------------------------------------------------------------
  // Test 2: Public User DTO Sanitization
  // --------------------------------------------------------------------------
  console.log("[Test 2] Validating PublicUser sanitization (data privacy)...");
  sampleUser.auth.passwordHash = "$2b$12$eX4mpL3h4sh3dStr1ngF0rT3st1ng";
  sampleUser.auth.verificationToken = "secret-token-123";
  sampleUser.apiKeys = {
    key_abc: {
      id: "key_abc",
      name: "Prod Key",
      prefix: "anim_live_abcdef12",
      keyHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      environment: "production",
      scopes: ["render:create"],
      rateLimitPerMinute: 60,
      status: "active",
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: null,
    },
  };

  const publicUser = toPublicUser(sampleUser);
  assert.equal((publicUser as any).auth.passwordHash, undefined, "passwordHash must be stripped");
  assert.equal((publicUser as any).auth.verificationToken, undefined, "verificationToken must be stripped");
  assert.equal((publicUser.apiKeys[0] as any).keyHash, undefined, "keyHash must not be exposed to client");
  assert.equal(publicUser.apiKeys[0].prefix, "anim_live_abcdef12");
  console.log("✓ Test 2 Passed: Public projection strips all sensitive secrets.\n");

  // --------------------------------------------------------------------------
  // Test 3: User Registration with Email and Password Hashing
  // --------------------------------------------------------------------------
  console.log("[Test 3] Testing UserService.createUserWithEmail...");
  const regResult = await userService.createUserWithEmail({
    email: "creator@studio.com",
    password: "SuperSecretPassword123!",
    name: "Studio Creator",
    plan: "creator",
  });

  assert.ok(regResult.user.id.startsWith("usr_"), "User ID should have prefix usr_");
  assert.equal(regResult.user.email, "creator@studio.com");
  assert.equal(regResult.user.plan.tier, "creator");
  assert.equal(regResult.user.usage.generations.limit, 150);
  assert.ok(regResult.user.auth.passwordHash?.startsWith("$2b$"), "Password must be hashed with bcrypt");

  // Attempt duplicate registration
  await assert.rejects(
    async () => {
      await userService.createUserWithEmail({
        email: "creator@studio.com",
        password: "AnotherPassword123!",
        name: "Duplicate User",
      });
    },
    /already exists/,
    "Duplicate email registration must be rejected"
  );
  console.log("✓ Test 3 Passed: User creation, password hashing, and duplicate protection verified.\n");

  // --------------------------------------------------------------------------
  // Test 4: Email Authentication & Password Verification
  // --------------------------------------------------------------------------
  console.log("[Test 4] Testing UserService.authenticateWithEmail...");
  const loginSuccess = await userService.authenticateWithEmail({
    email: "creator@studio.com",
    password: "SuperSecretPassword123!",
  });
  assert.equal(loginSuccess.user.email, "creator@studio.com");

  // Bad password rejection
  await assert.rejects(
    async () => {
      await userService.authenticateWithEmail({
        email: "creator@studio.com",
        password: "WrongPassword!",
      });
    },
    /Invalid email or password/,
    "Invalid password must be rejected"
  );
  console.log("✓ Test 4 Passed: Authentication successfully verifies bcrypt hash.\n");

  // --------------------------------------------------------------------------
  // Test 5: Google OAuth User Synchronization
  // --------------------------------------------------------------------------
  console.log("[Test 5] Testing UserService.syncGoogleUser...");
  const googleFirst = await userService.syncGoogleUser({
    id: "google_uid_987654321",
    email: "google.designer@gmail.com",
    name: "Google Designer",
    picture: "https://lh3.googleusercontent.com/avatar.jpg",
    emailVerified: true,
  });
  assert.equal(googleFirst.isNewUser, true, "First Google login creates user");
  assert.equal(googleFirst.user.auth.provider, "google");
  assert.equal(googleFirst.user.auth.emailVerified, true);
  assert.equal(googleFirst.user.profile.avatarUrl, "https://lh3.googleusercontent.com/avatar.jpg");

  const googleSecond = await userService.syncGoogleUser({
    id: "google_uid_987654321",
    email: "google.designer@gmail.com",
    name: "Google Designer Updated",
  });
  assert.equal(googleSecond.isNewUser, false, "Subsequent Google login updates existing record");
  console.log("✓ Test 5 Passed: Google OAuth idempotent synchronization verified.\n");

  // --------------------------------------------------------------------------
  // Test 6: API Key Creation, Rapid SHA-256 Lookup & Revocation
  // --------------------------------------------------------------------------
  console.log("[Test 6] Testing Developer API Key management and SHA-256 validation...");
  // Creator plan has pro key creation or sandbox key
  const keyCreation = await userService.createApiKey(regResult.user.id, {
    name: "CI/CD Render Pipeline",
    environment: "test",
    scopes: ["render:create", "render:read"],
  });

  assert.ok(keyCreation.secretKey.startsWith("anim_test_"), "Test key starts with anim_test_");
  assert.equal(keyCreation.apiKey.name, "CI/CD Render Pipeline");
  assert.equal(keyCreation.apiKey.status, "active");

  // Lookup via secret key
  const authenticatedKey = await userService.findByApiKey(keyCreation.secretKey);
  assert.ok(authenticatedKey, "API key lookup must succeed");
  assert.equal(authenticatedKey?.user.id, regResult.user.id);
  assert.equal(authenticatedKey?.apiKey.id, keyCreation.apiKey.id);

  // Revocation
  const revoked = await userService.revokeApiKey(regResult.user.id, keyCreation.apiKey.id);
  assert.equal(revoked, true, "Key revocation should succeed");

  const lookupAfterRevoke = await userService.findByApiKey(keyCreation.secretKey);
  assert.equal(lookupAfterRevoke, null, "Revoked key must not authenticate");
  console.log("✓ Test 6 Passed: Cryptographic API key lifecycle and instant lookup verified.\n");

  // --------------------------------------------------------------------------
  // Test 7: Usage Tracking & Plan Quota Enforcement
  // --------------------------------------------------------------------------
  console.log("[Test 7] Testing usage tracking and quota limits...");
  const freeUser = await userService.createUserWithEmail({
    email: "quota.test@motion.dev",
    password: "Password1234!",
    name: "Quota Tester",
    plan: "free", // Limit: 10 generations
  });

  // Record 9 generations
  const u1 = await userService.recordUsage(freeUser.user.id, "generations", 9);
  assert.equal(u1.success, true);
  assert.equal(u1.currentMonthly, 9);
  assert.equal(u1.exceeded, false);

  // Record 1 more (hits limit of 10)
  const u2 = await userService.recordUsage(freeUser.user.id, "generations", 1);
  assert.equal(u2.success, true);
  assert.equal(u2.currentMonthly, 10);

  // Attempt 11th generation (should be blocked)
  const u3 = await userService.recordUsage(freeUser.user.id, "generations", 1);
  assert.equal(u3.success, false, "Generation over quota must be rejected");
  assert.equal(u3.exceeded, true);

  // Upgrade user to Studio Pro (600 generations limit)
  const upgradedUser = await userService.updatePlan(freeUser.user.id, "pro");
  assert.equal(upgradedUser.plan.tier, "pro");
  assert.equal(upgradedUser.usage.generations.limit, 600);

  // Now recording should succeed immediately
  const u4 = await userService.recordUsage(freeUser.user.id, "generations", 1);
  assert.equal(u4.success, true, "Generation succeeds after tier upgrade");
  assert.equal(u4.currentMonthly, 11);
  console.log("✓ Test 7 Passed: Usage tracking, quota enforcement, and tier upgrades verified.\n");

  console.log("==================================================");
  console.log(" ALL 7 TEST SUITES PASSED SUCCESSFULLY (100%)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
