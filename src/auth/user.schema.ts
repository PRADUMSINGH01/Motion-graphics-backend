/**
 * Central User Schema Compatibility Layer
 * Re-exports everything from src/schemas/user.schema.ts and provides
 * backward-compatible wrappers for legacy callers.
 */

export * from "../schemas/user.schema.js";

import {
  buildDefaultUser,
  type UserRecord,
  type Role,
  type PlanTier,
  type AuthProvider,
} from "../schemas/user.schema.js";

export function buildUserRecord(input: {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: AuthProvider;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: Role;
  status?: string;
  plan?: PlanTier;
  locale?: string;
  lastSeenAt?: string | null;
}): UserRecord {
  return buildDefaultUser({
    id: input.id,
    email: input.email,
    name: input.name,
    avatarUrl: input.picture,
    provider: input.provider,
    emailVerified: input.emailVerified,
    role: input.role,
    plan: input.plan,
  });
}
