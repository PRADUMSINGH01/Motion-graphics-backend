import crypto from "node:crypto";
import bcrypt from "bcrypt";
import {
  db,
  auth,
  isFirebaseReady,
  encodeEmailKey,
} from "../../firebase/init.js";
import {
  UserRecord,
  UserRecordSchema,
  PublicUser,
  PublicApiKeyItem,
  ApiKeyRecord,
  CreateEmailUserDto,
  LoginEmailDto,
  CreateApiKeyDto,
  PlanTier,
  BillingInterval,
  PLAN_CONFIGS,
  buildDefaultUser,
  toPublicUser,
  computeNextResetDate,
} from "../schemas/user.schema.js";

// In-memory fallback repository for local offline development & standalone unit testing
class InMemoryUserStore {
  private users: Map<string, UserRecord> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> userId
  private apiKeyIndex: Map<string, { userId: string; keyId: string }> = new Map(); // keyHash -> { userId, keyId }

  async get(userId: string): Promise<UserRecord | null> {
    const u = this.users.get(userId);
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async getByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const userId = this.emailIndex.get(normalized);
    if (!userId) return null;
    return this.get(userId);
  }

  async getByApiKeyHash(keyHash: string): Promise<{ userId: string; keyId: string } | null> {
    return this.apiKeyIndex.get(keyHash) || null;
  }

  async set(user: UserRecord): Promise<void> {
    this.users.set(user.id, JSON.parse(JSON.stringify(user)));
    this.emailIndex.set(user.email.toLowerCase(), user.id);
  }

  async setApiKey(keyHash: string, userId: string, keyId: string): Promise<void> {
    this.apiKeyIndex.set(keyHash, { userId, keyId });
  }

  async removeApiKey(keyHash: string): Promise<void> {
    this.apiKeyIndex.delete(keyHash);
  }

  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
    this.apiKeyIndex.clear();
  }
}

export class UserService {
  private static instance: UserService;
  private inMemoryStore = new InMemoryUserStore();

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Clears the in-memory fallback store (useful in test runners).
   */
  public resetLocalStore(): void {
    this.inMemoryStore.clear();
  }

  // ==========================================================================
  // Lookups & Queries
  // ==========================================================================

  /**
   * Finds a user by unique User ID.
   */
  public async findById(userId: string): Promise<UserRecord | null> {
    if (!userId) return null;

    if (!isFirebaseReady()) {
      return this.inMemoryStore.get(userId);
    }

    try {
      const snapshot = await db.ref("Users").child(userId).once("value");
      const val = snapshot.val();
      if (!val) return null;
      return UserRecordSchema.parse(val);
    } catch (err) {
      console.error(`[UserService] Error fetching user ${userId} from DB:`, err);
      // Fallback to local store if RTDB network error
      return this.inMemoryStore.get(userId);
    }
  }

  /**
   * Finds a user by email address using O(1) atomic email index.
   */
  public async findByEmail(email: string): Promise<UserRecord | null> {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();

    if (!isFirebaseReady()) {
      return this.inMemoryStore.getByEmail(normalized);
    }

    try {
      const encodedEmail = encodeEmailKey(normalized);
      const indexSnap = await db.ref("indexes/usersByEmail").child(encodedEmail).once("value");
      const userId = indexSnap.val();

      if (!userId) return null;
      return this.findById(userId);
    } catch (err) {
      console.error(`[UserService] Error fetching user by email ${email}:`, err);
      return this.inMemoryStore.getByEmail(normalized);
    }
  }

  /**
   * Authenticates an API Key in O(1) time using SHA-256 hash lookup.
   */
  public async findByApiKey(plainKey: string): Promise<{ user: UserRecord; apiKey: ApiKeyRecord } | null> {
    if (!plainKey || (!plainKey.startsWith("anim_live_") && !plainKey.startsWith("anim_test_"))) {
      return null;
    }

    const keyHash = crypto.createHash("sha256").update(plainKey.trim()).digest("hex");

    let lookup: { userId: string; keyId: string } | null = null;

    if (isFirebaseReady()) {
      try {
        const snap = await db.ref("indexes/apiKeys").child(keyHash).once("value");
        lookup = snap.val();
      } catch (err) {
        console.error("[UserService] Error querying API key index:", err);
      }
    }

    if (!lookup) {
      lookup = await this.inMemoryStore.getByApiKeyHash(keyHash);
    }

    if (!lookup) return null;

    const user = await this.findById(lookup.userId);
    if (!user) return null;

    const apiKey = user.apiKeys?.[lookup.keyId];
    if (!apiKey || apiKey.status !== "active") return null;

    // Check expiration if set
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    // Asynchronously update lastUsedAt
    this.updateApiKeyLastUsed(user.id, apiKey.id).catch((e) =>
      console.error("[UserService] Error updating apiKey lastUsedAt:", e)
    );

    return { user, apiKey };
  }

  // ==========================================================================
  // User Registration & Creation
  // ==========================================================================

  /**
   * Registers a new user with Email and Password.
   */
  public async createUserWithEmail(
    dto: CreateEmailUserDto,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ user: UserRecord; publicUser: PublicUser }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Verify email uniqueness
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      throw new Error("An account with this email address already exists.");
    }

    // 2. Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 3. Generate secure User ID
    const userId = `usr_${crypto.randomBytes(12).toString("hex")}`;

    // 4. Build standard production UserRecord
    const userRecord = buildDefaultUser({
      id: userId,
      email: normalizedEmail,
      name: dto.name,
      username: dto.username,
      provider: "email",
      passwordHash,
      emailVerified: false,
      plan: dto.plan || "free",
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    // 5. Persist to Firebase / Memory
    await this.persistUserWithIndex(userRecord);

    // 6. Optionally sync with Firebase Auth if available
    if (isFirebaseReady()) {
      try {
        await auth.createUser({
          uid: userId,
          email: normalizedEmail,
          displayName: dto.name,
          emailVerified: false,
        });
      } catch (authErr: any) {
        // Log warning if Firebase Auth user already exists or fails, but do not abort RTDB write
        console.warn("[UserService] Firebase Auth createUser notice:", authErr?.message);
      }
    }

    return {
      user: userRecord,
      publicUser: toPublicUser(userRecord),
    };
  }

  /**
   * Synchronizes or creates a user from Google OAuth ID token credentials.
   */
  public async syncGoogleUser(
    profile: {
      id: string; // Google sub ID or Firebase UID
      email: string;
      name: string;
      picture?: string | null;
      emailVerified?: boolean;
    },
    meta?: { ip?: string; userAgent?: string; plan?: string }
  ): Promise<{ user: UserRecord; publicUser: PublicUser; isNewUser: boolean }> {
    const normalizedEmail = profile.email.trim().toLowerCase();
    const now = new Date().toISOString();

    // Check if user exists by email or by Google ID
    let existingUser = await this.findByEmail(normalizedEmail);
    if (!existingUser) {
      existingUser = await this.findById(profile.id);
    }

    if (existingUser) {
      // User exists -> Update profile & login audit
      existingUser.auth.emailVerified = profile.emailVerified ?? existingUser.auth.emailVerified;
      if (profile.picture && !existingUser.profile.avatarUrl) {
        existingUser.profile.avatarUrl = profile.picture;
      }
      existingUser.audit.lastLoginAt = now;
      existingUser.audit.updatedAt = now;
      if (meta?.ip) existingUser.audit.lastLoginIp = meta.ip;
      if (meta?.userAgent) existingUser.audit.lastUserAgent = meta.userAgent;

      await this.persistUser(existingUser);

      return {
        user: existingUser,
        publicUser: toPublicUser(existingUser),
        isNewUser: false,
      };
    }

    // Determine plan for new user
    const selectedPlan: PlanTier =
      meta?.plan && ["free", "creator", "pro", "enterprise"].includes(meta.plan)
        ? (meta.plan as PlanTier)
        : "free";

    // User is new -> Create full UserRecord
    const userId = profile.id || `usr_${crypto.randomBytes(12).toString("hex")}`;
    const newUser = buildDefaultUser({
      id: userId,
      email: normalizedEmail,
      name: profile.name,
      provider: "google",
      avatarUrl: profile.picture,
      emailVerified: profile.emailVerified ?? true,
      firebaseUid: profile.id,
      plan: selectedPlan,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    await this.persistUserWithIndex(newUser);

    return {
      user: newUser,
      publicUser: toPublicUser(newUser),
      isNewUser: true,
    };
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Validates email & password credentials for login.
   */
  public async authenticateWithEmail(
    dto: LoginEmailDto,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ user: UserRecord; publicUser: PublicUser }> {
    const user = await this.findByEmail(dto.email);
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    if (!user.auth.passwordHash) {
      throw new Error(
        `This account is registered via ${user.auth.provider}. Please sign in using ${user.auth.provider}.`
      );
    }

    if (user.auth.status !== "active") {
      throw new Error(`Your account is currently ${user.auth.status}. Please contact support.`);
    }

    const isMatch = await bcrypt.compare(dto.password, user.auth.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }

    // Update login audit
    const now = new Date().toISOString();
    user.audit.lastLoginAt = now;
    user.audit.updatedAt = now;
    if (meta?.ip) user.audit.lastLoginIp = meta.ip;
    if (meta?.userAgent) user.audit.lastUserAgent = meta.userAgent;

    await this.persistUser(user);

    return {
      user,
      publicUser: toPublicUser(user),
    };
  }

  // ==========================================================================
  // Developer API Key Management
  // ==========================================================================

  /**
   * Generates a new API secret key and registers its SHA-256 hash.
   * Returns the secret key once.
   */
  public async createApiKey(
    userId: string,
    dto: CreateApiKeyDto
  ): Promise<{ apiKey: ApiKeyRecord; secretKey: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    // Check plan permissions
    const tierConfig = PLAN_CONFIGS[user.plan.tier] || PLAN_CONFIGS.free;
    if (!tierConfig.apiAccess && dto.environment === "production") {
      throw new Error(
        `API key generation in production requires a Studio Pro or Enterprise plan. Current plan: ${user.plan.tier}`
      );
    }

    const keyId = `key_${crypto.randomBytes(8).toString("hex")}`;
    const envPrefix = dto.environment === "test" || dto.environment === "sandbox" ? "anim_test_" : "anim_live_";
    const secretRandom = crypto.randomBytes(24).toString("hex");
    const secretKey = `${envPrefix}${secretRandom}`;
    const prefix = `${envPrefix}${secretRandom.substring(0, 8)}`;
    const keyHash = crypto.createHash("sha256").update(secretKey).digest("hex");

    const now = new Date().toISOString();
    let expiresAt: string | null = null;
    if (dto.expiresInDays) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + dto.expiresInDays);
      expiresAt = expDate.toISOString();
    }

    const apiKeyRecord: ApiKeyRecord = {
      id: keyId,
      name: dto.name.trim(),
      prefix,
      keyHash,
      environment: dto.environment || "production",
      scopes: dto.scopes && dto.scopes.length > 0 ? dto.scopes : ["render:create", "render:read"],
      rateLimitPerMinute: tierConfig.apiRateLimitPerMinute || 60,
      status: "active",
      createdAt: now,
      lastUsedAt: null,
      expiresAt,
    };

    if (!user.apiKeys) {
      user.apiKeys = {};
    }
    user.apiKeys[keyId] = apiKeyRecord;
    user.audit.updatedAt = now;

    if (isFirebaseReady()) {
      const updates: Record<string, any> = {};
      updates[`Users/${user.id}/apiKeys/${keyId}`] = apiKeyRecord;
      updates[`Users/${user.id}/audit/updatedAt`] = now;
      updates[`indexes/apiKeys/${keyHash}`] = { userId: user.id, keyId };
      await db.ref().update(updates);
    }

    await this.inMemoryStore.set(user);
    await this.inMemoryStore.setApiKey(keyHash, user.id, keyId);

    return {
      apiKey: apiKeyRecord,
      secretKey,
    };
  }

  /**
   * Lists public representations of a user's API keys (hiding hashes).
   */
  public async listApiKeys(userId: string): Promise<PublicApiKeyItem[]> {
    const user = await this.findById(userId);
    if (!user || !user.apiKeys) return [];

    return Object.values(user.apiKeys).map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      environment: k.environment,
      scopes: k.scopes,
      rateLimitPerMinute: k.rateLimitPerMinute,
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
    }));
  }

  /**
   * Revokes an API key.
   */
  public async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user || !user.apiKeys || !user.apiKeys[keyId]) {
      return false;
    }

    const keyRecord = user.apiKeys[keyId];
    keyRecord.status = "revoked";
    user.audit.updatedAt = new Date().toISOString();

    if (isFirebaseReady()) {
      const updates: Record<string, any> = {};
      updates[`Users/${user.id}/apiKeys/${keyId}/status`] = "revoked";
      updates[`Users/${user.id}/audit/updatedAt`] = user.audit.updatedAt;
      updates[`indexes/apiKeys/${keyRecord.keyHash}`] = null;
      await db.ref().update(updates);
    }

    await this.inMemoryStore.set(user);
    await this.inMemoryStore.removeApiKey(keyRecord.keyHash);

    return true;
  }

  private async updateApiKeyLastUsed(userId: string, keyId: string): Promise<void> {
    const now = new Date().toISOString();
    if (isFirebaseReady()) {
      await db.ref(`Users/${userId}/apiKeys/${keyId}/lastUsedAt`).set(now);
    }
    const local = await this.inMemoryStore.get(userId);
    if (local && local.apiKeys?.[keyId]) {
      local.apiKeys[keyId].lastUsedAt = now;
      await this.inMemoryStore.set(local);
    }
  }

  // ==========================================================================
  // Usage Tracking & Quota Enforcement
  // ==========================================================================

  /**
   * Increments usage counters and checks against quota limits.
   */
  public async recordUsage(
    userId: string,
    type: "generations" | "renders" | "apiCalls",
    amount = 1
  ): Promise<{ success: boolean; exceeded: boolean; currentMonthly: number; limit: number }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Check if period needs reset
    if (new Date(user.usage.nextResetAt) <= now) {
      user.usage.generations.monthly = 0;
      user.usage.renders.monthly = 0;
      user.usage.apiCalls.monthly = 0;
      user.usage.lastResetAt = nowIso;
      user.usage.nextResetAt = computeNextResetDate(now);
    }

    const counter = user.usage[type];
    const isExceeded = counter.limit !== -1 && counter.monthly + amount > counter.limit;

    if (isExceeded) {
      return {
        success: false,
        exceeded: true,
        currentMonthly: counter.monthly,
        limit: counter.limit,
      };
    }

    counter.daily += amount;
    counter.monthly += amount;
    counter.lifetime += amount;
    user.audit.updatedAt = nowIso;

    await this.persistUser(user);

    return {
      success: true,
      exceeded: false,
      currentMonthly: counter.monthly,
      limit: counter.limit,
    };
  }

  // ==========================================================================
  // Plan & Subscription Management
  // ==========================================================================

  /**
   * Upgrades or downgrades a user's subscription tier.
   */
  public async updatePlan(
    userId: string,
    newTier: PlanTier,
    interval: BillingInterval = "monthly"
  ): Promise<PublicUser> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const config = PLAN_CONFIGS[newTier] || PLAN_CONFIGS.free;
    const now = new Date().toISOString();
    const nextReset = computeNextResetDate();

    user.plan.tier = newTier;
    user.plan.billingInterval = interval;
    user.plan.status = "active";
    user.plan.currentPeriodStart = now;
    user.plan.currentPeriodEnd = nextReset;
    user.plan.features = [...config.features];

    // Adjust quota limits
    user.usage.generations.limit = config.generationsPerMonth;
    user.usage.storage.limitBytes = config.storageLimitBytes;
    user.audit.updatedAt = now;

    await this.persistUser(user);

    return toPublicUser(user);
  }

  // ==========================================================================
  // Persistence Helpers
  // ==========================================================================

  private async persistUser(user: UserRecord): Promise<void> {
    if (isFirebaseReady()) {
      await db.ref("Users").child(user.id).set(user);
    }
    await this.inMemoryStore.set(user);
  }

  private async persistUserWithIndex(user: UserRecord): Promise<void> {
    const encodedEmail = encodeEmailKey(user.email);

    if (isFirebaseReady()) {
      const updates: Record<string, any> = {};
      updates[`Users/${user.id}`] = user;
      updates[`indexes/usersByEmail/${encodedEmail}`] = user.id;
      await db.ref().update(updates);
    }

    await this.inMemoryStore.set(user);
  }
}

export const userService = UserService.getInstance();
export default userService;
