import { z } from "zod";

// ============================================================================
// 1. Enums & Literal Schemas
// ============================================================================

export const RoleSchema = z.enum(["user", "creator", "admin", "moderator", "superadmin"]);
export type Role = z.infer<typeof RoleSchema>;

export const AccountStatusSchema = z.enum(["active", "pending", "suspended", "deactivated"]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AuthProviderSchema = z.enum(["email", "google", "github", "apple"]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const PlanTierSchema = z.enum(["free", "creator", "pro", "enterprise"]);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const BillingIntervalSchema = z.enum(["monthly", "annual", "lifetime"]);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const SubscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const ApiKeyStatusSchema = z.enum(["active", "revoked", "expired"]);
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

export const ApiKeyEnvSchema = z.enum(["production", "sandbox", "test"]);
export type ApiKeyEnv = z.infer<typeof ApiKeyEnvSchema>;

export const ThemeSchema = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

// ============================================================================
// 2. Plan Tier Default Configurations & Quotas
// ============================================================================

export interface TierConfig {
  tier: PlanTier;
  name: string;
  generationsPerMonth: number; // -1 for unlimited
  maxConcurrentRenders: number;
  maxResolution: "720p" | "1080p" | "4K" | "8K";
  maxFps: 30 | 60 | 120;
  apiAccess: boolean;
  apiRateLimitPerMinute: number;
  storageLimitBytes: number;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, TierConfig> = {
  free: {
    tier: "free",
    name: "Free Trial",
    generationsPerMonth: 10,
    maxConcurrentRenders: 1,
    maxResolution: "1080p",
    maxFps: 30,
    apiAccess: false,
    apiRateLimitPerMinute: 0,
    storageLimitBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    features: ["standard_queue", "community_templates", "web_preview"],
  },
  creator: {
    tier: "creator",
    name: "Creator",
    generationsPerMonth: 150,
    maxConcurrentRenders: 2,
    maxResolution: "1080p",
    maxFps: 60,
    apiAccess: false,
    apiRateLimitPerMinute: 0,
    storageLimitBytes: 25 * 1024 * 1024 * 1024, // 25 GB
    features: [
      "1080p_60fps_export",
      "full_lottie_json",
      "kinetic_3d_typography",
      "commercial_license",
      "standard_gpu_queue",
    ],
  },
  pro: {
    tier: "pro",
    name: "Studio Pro",
    generationsPerMonth: 600,
    maxConcurrentRenders: 5,
    maxResolution: "4K",
    maxFps: 60,
    apiAccess: true,
    apiRateLimitPerMinute: 60,
    storageLimitBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    features: [
      "4k_lossless_prores",
      "editable_aep_export",
      "priority_gpu_cluster",
      "advanced_camera_physics",
      "api_access",
      "team_workspace_5_seats",
    ],
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    generationsPerMonth: -1, // Unlimited
    maxConcurrentRenders: 20,
    maxResolution: "8K",
    maxFps: 120,
    apiAccess: true,
    apiRateLimitPerMinute: 300,
    storageLimitBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
    features: [
      "unlimited_generations",
      "fine_tuned_brand_models",
      "headless_api_webhooks",
      "dedicated_gpu_cluster",
      "enterprise_sla_99_9",
      "sso_saml",
      "dedicated_account_manager",
    ],
  },
};

// ============================================================================
// 3. Sub-Schemas
// ============================================================================

export const ProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(100),
  firstName: z.string().max(60).nullable().default(null),
  lastName: z.string().max(60).nullable().default(null),
  avatarUrl: z.string().nullable().default(null),
  bio: z.string().max(300).nullable().default(null),
  company: z.string().max(100).nullable().default(null),
  website: z.string().max(200).nullable().default(null),
  location: z.string().max(100).nullable().default(null),
  locale: z.string().max(10).default("en"),
  timezone: z.string().max(50).default("UTC"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const AuthDetailsSchema = z.object({
  provider: AuthProviderSchema,
  firebaseUid: z.string().nullable().default(null),
  passwordHash: z.string().nullable().default(null),
  emailVerified: z.boolean().default(false),
  role: RoleSchema.default("user"),
  status: AccountStatusSchema.default("active"),
  permissions: z.array(z.string()).default([]),
  verificationToken: z.string().nullable().default(null),
  verificationTokenExpiresAt: z.string().nullable().default(null),
  resetPasswordToken: z.string().nullable().default(null),
  resetPasswordExpiresAt: z.string().nullable().default(null),
});
export type AuthDetails = z.infer<typeof AuthDetailsSchema>;

export const PlanSubscriptionSchema = z.object({
  tier: PlanTierSchema.default("free"),
  status: SubscriptionStatusSchema.default("active"),
  billingInterval: BillingIntervalSchema.default("monthly"),
  startedAt: z.string(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean().default(false),
  canceledAt: z.string().nullable().default(null),
  trialEndsAt: z.string().nullable().default(null),
  stripeCustomerId: z.string().nullable().default(null),
  stripeSubscriptionId: z.string().nullable().default(null),
  stripePriceId: z.string().nullable().default(null),
  features: z.array(z.string()).default([]),
});
export type PlanSubscription = z.infer<typeof PlanSubscriptionSchema>;

export const CounterSchema = z.object({
  daily: z.number().nonnegative().default(0),
  monthly: z.number().nonnegative().default(0),
  lifetime: z.number().nonnegative().default(0),
  limit: z.number().default(-1), // -1 for unlimited
});
export type Counter = z.infer<typeof CounterSchema>;

export const StorageUsageSchema = z.object({
  usedBytes: z.number().nonnegative().default(0),
  limitBytes: z.number().default(1024 * 1024 * 1024),
});
export type StorageUsage = z.infer<typeof StorageUsageSchema>;

export const UsageQuotaSchema = z.object({
  generations: CounterSchema,
  renders: CounterSchema,
  apiCalls: CounterSchema,
  storage: StorageUsageSchema,
  lastResetAt: z.string(),
  nextResetAt: z.string(),
});
export type UsageQuota = z.infer<typeof UsageQuotaSchema>;

export const ApiKeyRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  prefix: z.string().min(6).max(30), // e.g. anim_live_89f3bc19
  keyHash: z.string().length(64), // SHA-256 hex string
  environment: ApiKeyEnvSchema.default("production"),
  scopes: z.array(z.string()).default(["render:create", "render:read"]),
  rateLimitPerMinute: z.number().positive().default(60),
  status: ApiKeyStatusSchema.default("active"),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
});
export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>;

export const UserSettingsSchema = z.object({
  theme: ThemeSchema.default("dark"),
  notifications: z
    .object({
      emailAlerts: z.boolean().default(true),
      marketingEmails: z.boolean().default(false),
      securityAlerts: z.boolean().default(true),
      usageAlerts: z.boolean().default(true),
    })
    .default({
      emailAlerts: true,
      marketingEmails: false,
      securityAlerts: true,
      usageAlerts: true,
    }),
  renderDefaults: z
    .object({
      format: z.enum(["webm", "mp4", "prores", "lottie"]).default("webm"),
      fps: z.number().default(60),
      resolution: z.enum(["720p", "1080p", "4K"]).default("1080p"),
    })
    .default({
      format: "webm",
      fps: 60,
      resolution: "1080p",
    }),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const WorkspaceMembershipSchema = z.object({
  workspaceId: z.string().nullable().default(null),
  role: z.enum(["owner", "admin", "member", "viewer"]).nullable().default(null),
});
export type WorkspaceMembership = z.infer<typeof WorkspaceMembershipSchema>;

export const AuditMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string(),
  lastLoginIp: z.string().nullable().default(null),
  lastUserAgent: z.string().nullable().default(null),
  version: z.number().default(1),
});
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

// ============================================================================
// 4. Central User Record Schema (Stored in DB)
// ============================================================================

export const UserRecordSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z
    .string()
    .email("A valid email address is required.")
    .transform((val) => val.trim().toLowerCase()),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must not exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, dashes, and underscores."),
  profile: ProfileSchema,
  auth: AuthDetailsSchema,
  plan: PlanSubscriptionSchema,
  usage: UsageQuotaSchema,
  apiKeys: z.record(z.string(), ApiKeyRecordSchema).default({}),
  settings: UserSettingsSchema.default({
    theme: "dark",
    notifications: {
      emailAlerts: true,
      marketingEmails: false,
      securityAlerts: true,
      usageAlerts: true,
    },
    renderDefaults: {
      format: "webm",
      fps: 60,
      resolution: "1080p",
    },
  }),
  workspace: WorkspaceMembershipSchema.default({
    workspaceId: null,
    role: null,
  }),
  audit: AuditMetadataSchema,
});
export type UserRecord = z.infer<typeof UserRecordSchema>;

// ============================================================================
// 5. Sanitized Public User DTO (Safe for API Responses & Client)
// ============================================================================

export interface PublicApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: ApiKeyEnv;
  scopes: string[];
  rateLimitPerMinute: number;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  profile: Profile;
  auth: {
    provider: AuthProvider;
    emailVerified: boolean;
    role: Role;
    status: AccountStatus;
    permissions: string[];
  };
  plan: PlanSubscription;
  usage: UsageQuota;
  apiKeys: PublicApiKeyItem[];
  settings: UserSettings;
  workspace: WorkspaceMembership;
  createdAt: string;
  lastLoginAt: string;
}

/**
 * Strips all sensitive credentials, hashes, and internal tokens from a UserRecord.
 */
export function toPublicUser(user: UserRecord): PublicUser {
  const publicApiKeys: PublicApiKeyItem[] = Object.values(user.apiKeys || {}).map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    environment: key.environment,
    scopes: key.scopes,
    rateLimitPerMinute: key.rateLimitPerMinute,
    status: key.status,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
  }));

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profile: { ...user.profile },
    auth: {
      provider: user.auth.provider,
      emailVerified: user.auth.emailVerified,
      role: user.auth.role,
      status: user.auth.status,
      permissions: [...user.auth.permissions],
    },
    plan: { ...user.plan },
    usage: { ...user.usage },
    apiKeys: publicApiKeys,
    settings: { ...user.settings },
    workspace: { ...user.workspace },
    createdAt: user.audit.createdAt,
    lastLoginAt: user.audit.lastLoginAt,
  };
}

// ============================================================================
// 6. Registration & Mutation DTO Schemas
// ============================================================================

export const CreateEmailUserDtoSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(100, "Password is too long."),
  name: z.string().min(2, "Name must be at least 2 characters.").max(100),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username must be alphanumeric.")
    .optional(),
  plan: PlanTierSchema.optional().default("free"),
});
export type CreateEmailUserDto = z.input<typeof CreateEmailUserDtoSchema>;


export const LoginEmailDtoSchema = z.object({
  email: z.string().email("A valid email is required."),
  password: z.string().min(1, "Password is required."),
});
export type LoginEmailDto = z.infer<typeof LoginEmailDtoSchema>;

export const CreateApiKeyDtoSchema = z.object({
  name: z.string().min(1, "Key name is required.").max(60),
  environment: ApiKeyEnvSchema.optional().default("production"),
  scopes: z.array(z.string()).optional().default(["render:create", "render:read"]),
  expiresInDays: z.number().int().positive().nullable().optional(),
});
export type CreateApiKeyDto = z.infer<typeof CreateApiKeyDtoSchema>;

// ============================================================================
// 7. Factory Functions & Helper Methods
// ============================================================================

export function computeNextResetDate(now: Date = new Date()): string {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return nextMonth.toISOString();
}

/**
 * Builds a complete UserRecord with default configs, quotas, and structure.
 */
export function buildDefaultUser(input: {
  id: string;
  email: string;
  name: string;
  username?: string;
  provider: AuthProvider;
  passwordHash?: string | null;
  emailVerified?: boolean;
  avatarUrl?: string | null;
  firebaseUid?: string | null;
  role?: Role;
  plan?: PlanTier;
  ipAddress?: string | null;
  userAgent?: string | null;
}): UserRecord {
  const now = new Date().toISOString();
  const nextReset = computeNextResetDate();
  const selectedPlan = input.plan || "free";
  const tierConfig = PLAN_CONFIGS[selectedPlan] || PLAN_CONFIGS.free;

  // Derive username if not explicitly supplied
  const baseUsername =
    input.username ||
    input.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 20) ||
    `user_${Math.random().toString(36).substring(2, 8)}`;

  // Name splitting for first/last name convenience
  const nameParts = input.name.trim().split(" ");
  const firstName = nameParts[0] || input.name;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  const userPayload: UserRecord = {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    username: baseUsername.toLowerCase(),
    profile: {
      displayName: input.name.trim(),
      firstName,
      lastName,
      avatarUrl: input.avatarUrl ?? null,
      bio: null,
      company: null,
      website: null,
      location: null,
      locale: "en",
      timezone: "UTC",
    },
    auth: {
      provider: input.provider,
      firebaseUid: input.firebaseUid ?? null,
      passwordHash: input.passwordHash ?? null,
      emailVerified: input.emailVerified ?? false,
      role: input.role ?? "user",
      status: "active",
      permissions: input.role === "admin" ? ["*"] : ["render:create", "render:read"],
      verificationToken: null,
      verificationTokenExpiresAt: null,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    },
    plan: {
      tier: selectedPlan,
      status: "active",
      billingInterval: "monthly",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: nextReset,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      features: [...tierConfig.features],
    },
    usage: {
      generations: {
        daily: 0,
        monthly: 0,
        lifetime: 0,
        limit: tierConfig.generationsPerMonth,
      },
      renders: {
        daily: 0,
        monthly: 0,
        lifetime: 0,
        limit: -1,
      },
      apiCalls: {
        daily: 0,
        monthly: 0,
        lifetime: 0,
        limit: tierConfig.apiRateLimitPerMinute * 60 * 24 * 30, // approximate monthly cap if active
      },
      storage: {
        usedBytes: 0,
        limitBytes: tierConfig.storageLimitBytes,
      },
      lastResetAt: now,
      nextResetAt: nextReset,
    },
    apiKeys: {},
    settings: {
      theme: "dark",
      notifications: {
        emailAlerts: true,
        marketingEmails: false,
        securityAlerts: true,
        usageAlerts: true,
      },
      renderDefaults: {
        format: "webm",
        fps: 60,
        resolution: "1080p",
      },
    },
    workspace: {
      workspaceId: null,
      role: null,
    },
    audit: {
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastLoginIp: input.ipAddress ?? null,
      lastUserAgent: input.userAgent ?? null,
      version: 1,
    },
  };

  return UserRecordSchema.parse(userPayload);
}

/**
 * Checks if a user has exceeded their generation quota for the current cycle.
 */
export function hasExceededGenerations(user: UserRecord): boolean {
  if (user.usage.generations.limit === -1) {
    return false; // Unlimited enterprise tier
  }
  return user.usage.generations.monthly >= user.usage.generations.limit;
}
