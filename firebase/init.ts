import dotenv from "dotenv";
dotenv.config();

import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
  type AppOptions,
  type ServiceAccount,
} from "firebase-admin/app";
import { getDatabase as getAdminDatabase, type Database } from "firebase-admin/database";
import { getAuth as getAdminAuth, type Auth } from "firebase-admin/auth";
import { getStorage as getAdminStorage, type Storage } from "firebase-admin/storage";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FirebaseAdminConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  databaseURL?: string;
  storageBucket?: string;
}

export type InitSource =
  | "service-account-env"
  | "service-account-json"
  | "application-default"
  | "unconfigured";

export interface FirebaseStatus {
  isReady: boolean;
  projectId?: string;
  clientEmail?: string;
  databaseURL?: string;
  storageBucket?: string;
  initSource: InitSource;
  error?: string;
}

// ============================================================================
// Credential Normalization & Sanitization
// ============================================================================

/**
 * Normalizes and sanitizes private keys from environment variables.
 * Handles escaped newlines ("\n"), outer quotes, and carriage returns.
 */
function sanitizePrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  let sanitized = key.trim();

  // Strip wrapping double or single quotes if present
  if (
    (sanitized.startsWith('"') && sanitized.endsWith('"')) ||
    (sanitized.startsWith("'") && sanitized.endsWith("'"))
  ) {
    sanitized = sanitized.slice(1, -1);
  }

  // Unescape literal \n into real newlines and strip CR
  sanitized = sanitized.replace(/\\n/g, "\n").replace(/\r/g, "").trim();

  return sanitized;
}

/**
 * Parses a service account JSON string or base64-encoded JSON if provided.
 */
function parseServiceAccountJson(raw?: string): ServiceAccount | null {
  if (!raw || !raw.trim()) return null;
  try {
    const trimmed = raw.trim();
    const jsonStr = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf8");

    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: sanitizePrivateKey(parsed.private_key || parsed.privateKey),
      };
    }
  } catch {
    // Ignore parse errors; will fall back to other config sources
  }
  return null;
}

/**
 * Resolves Firebase configuration across standard environment variable conventions.
 */
function resolveFirebaseConfig(): {
  config: FirebaseAdminConfig;
  source: InitSource;
  isValid: boolean;
} {
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL?.trim() ||
    process.env.FIREBASE_REALTIME_DATABASE_URL?.trim();

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_URL?.trim();

  // 1. Check for single JSON service account (plain or base64)
  const jsonRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_ADMIN ||
    process.env.FIREBASE_CONFIG;
  const jsonAccount = parseServiceAccountJson(jsonRaw);

  if (jsonAccount?.clientEmail && jsonAccount?.privateKey) {
    return {
      config: {
        projectId: jsonAccount.projectId,
        clientEmail: jsonAccount.clientEmail,
        privateKey: jsonAccount.privateKey,
        databaseURL,
        storageBucket,
      },
      source: "service-account-json",
      isValid: true,
    };
  }

  // 2. Check for individual environment variables
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim();

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  const isPlaceholder = (val?: string) =>
    Boolean(
      val &&
        (val.includes("your-project") ||
          val.includes("your-service-account") ||
          val.includes("example.com"))
    );

  const hasValidIndividualCreds = Boolean(
    projectId &&
      clientEmail &&
      privateKey &&
      !isPlaceholder(projectId) &&
      !isPlaceholder(clientEmail) &&
      privateKey.includes("BEGIN PRIVATE KEY") &&
      privateKey.includes("END PRIVATE KEY")
  );

  if (hasValidIndividualCreds) {
    return {
      config: {
        projectId,
        clientEmail,
        privateKey,
        databaseURL,
        storageBucket,
      },
      source: "service-account-env",
      isValid: true,
    };
  }

  // 3. Fallback: Google Application Default Credentials (e.g. Cloud Run, App Hosting, GCE)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
    return {
      config: {
        projectId,
        databaseURL,
        storageBucket,
      },
      source: "application-default",
      isValid: true,
    };
  }

  return {
    config: {
      projectId,
      clientEmail,
      privateKey,
      databaseURL,
      storageBucket,
    },
    source: "unconfigured",
    isValid: false,
  };
}

// ============================================================================
// Singleton Initialization
// ============================================================================

let initializedApp: App | null = null;
let initError: string | null = null;
const resolved = resolveFirebaseConfig();

function initializeFirebaseAdmin(): App | null {
  // If already initialized in this process (or across hot reloads), reuse existing app
  const existingApps = getApps();
  if (existingApps.length > 0) {
    initializedApp = existingApps[0] || getApp();
    return initializedApp;
  }

  if (!resolved.isValid) {
    const missing: string[] = [];
    if (!resolved.config.projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!resolved.config.clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!resolved.config.privateKey) missing.push("FIREBASE_PRIVATE_KEY");
    if (!resolved.config.databaseURL) missing.push("FIREBASE_DATABASE_URL");

    initError = `Missing or incomplete credentials: [${missing.join(", ")}]`;
    console.warn(
      `[Firebase Admin] Running in offline/mock mode. Missing credentials: ${missing.join(", ")}. Realtime Database & live Auth will be disabled.`
    );
    return null;
  }

  try {
    const options: AppOptions = {};

    if (resolved.source === "application-default") {
      options.credential = applicationDefault();
    } else if (
      resolved.config.projectId &&
      resolved.config.clientEmail &&
      resolved.config.privateKey
    ) {
      options.credential = cert({
        projectId: resolved.config.projectId,
        clientEmail: resolved.config.clientEmail,
        privateKey: resolved.config.privateKey,
      });
    }

    if (resolved.config.projectId) {
      options.projectId = resolved.config.projectId;
    }

    if (resolved.config.databaseURL) {
      options.databaseURL = resolved.config.databaseURL;
    }

    if (resolved.config.storageBucket) {
      options.storageBucket = resolved.config.storageBucket;
    }

    initializedApp = initializeApp(options);

    const maskedEmail = resolved.config.clientEmail
      ? resolved.config.clientEmail.replace(/^([^@]{3})[^@]+(@.+)$/, "$1***$2")
      : "ADC";

    console.log(
      `[Firebase Admin] Initialized successfully. Project: ${resolved.config.projectId || "default"}, Account: ${maskedEmail}, Source: ${resolved.source}`
    );

    return initializedApp;
  } catch (err: any) {
    initError = err?.message || String(err);
    console.error("[Firebase Admin] Initialization failed:", err);
    return null;
  }
}

// Trigger initialization immediately upon module import
initializeFirebaseAdmin();

// ============================================================================
// Service Getters & Diagnostics
// ============================================================================

/**
 * Checks whether Firebase Admin SDK is successfully initialized and ready for live operations.
 */
export const isFirebaseReady = (): boolean => {
  return Boolean(initializedApp && getApps().length > 0);
};

/**
 * Returns diagnostic metadata about current Firebase Admin configuration status.
 */
export const getFirebaseStatus = (): FirebaseStatus => {
  return {
    isReady: isFirebaseReady(),
    projectId: resolved.config.projectId,
    clientEmail: resolved.config.clientEmail,
    databaseURL: resolved.config.databaseURL,
    storageBucket: resolved.config.storageBucket,
    initSource: resolved.source,
    error: initError || undefined,
  };
};

/**
 * Returns the initialized Firebase App instance or throws an informative error.
 */
export const getFirebaseApp = (): App => {
  if (!initializedApp) {
    initializedApp = initializeFirebaseAdmin();
  }
  if (!initializedApp) {
    throw new Error(
      `[Firebase Admin] App is not initialized. ${initError || "Check FIREBASE_* credentials in .env"}`
    );
  }
  return initializedApp;
};

/**
 * Returns the Firebase Realtime Database service.
 */
export const getDb = (): Database => {
  const app = getFirebaseApp();
  return getAdminDatabase(app);
};

/**
 * Returns the Firebase Auth service.
 */
export const getAuth = (): Auth => {
  const app = getFirebaseApp();
  return getAdminAuth(app);
};

/**
 * Returns the Cloud Storage service.
 */
export const getStorage = (): Storage => {
  const app = getFirebaseApp();
  return getAdminStorage(app);
};

// ============================================================================
// Typed Proxies for Direct Access (Backward Compatibility)
// ============================================================================

function createServiceProxy<T extends object>(serviceName: string, getter: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (!isFirebaseReady()) {
        return (..._args: any[]) => {
          throw new Error(
            `[Firebase Admin] Cannot call "${serviceName}.${String(prop)}": Firebase is not initialized. Please configure valid FIREBASE_* environment variables in .env.`
          );
        };
      }
      const instance = getter();
      const val = (instance as any)[prop];
      return typeof val === "function" ? val.bind(instance) : val;
    },
  });
}

/**
 * Realtime Database instance proxy.
 * Safe to call directly: `db.ref("path").once("value")`
 */
export const db: Database = createServiceProxy<Database>("db", getDb);

/**
 * Firebase Auth instance proxy.
 * Safe to call directly: `auth.createUser({...})` or `auth.verifyIdToken(token)`
 */
export const auth: Auth = createServiceProxy<Auth>("auth", getAuth);

/**
 * Cloud Storage instance proxy.
 * Safe to call directly: `storage.bucket()`
 */
export const storage: Storage = createServiceProxy<Storage>("storage", getStorage);

/**
 * Alias for backward compatibility with existing code importing `firebaseAdminApp`.
 */
export const firebaseAdminApp = {
  get app() {
    return isFirebaseReady() ? getFirebaseApp() : null;
  },
  apps: getApps(),
  database: () => db,
  auth: () => auth,
  storage: () => storage,
};

// ============================================================================
// Connectivity & Health Verification
// ============================================================================

/**
 * Performs a live connectivity check against Firebase Realtime Database and Auth.
 */
export async function verifyFirebaseConnection(): Promise<{
  ok: boolean;
  message: string;
  details: {
    authConnected: boolean;
    databaseConnected: boolean;
    projectId?: string;
  };
}> {
  if (!isFirebaseReady()) {
    return {
      ok: false,
      message: `Firebase Admin not configured: ${initError || "Missing environment variables"}`,
      details: { authConnected: false, databaseConnected: false },
    };
  }

  let authConnected = false;
  let databaseConnected = false;

  try {
    // 1. Test Auth service by fetching project configuration
    const authInstance = getAuth();
    await authInstance.projectConfigManager().getProjectConfig();
    authConnected = true;
  } catch (err: any) {
    // Some service accounts might not have permission to read project config; fallback to token check
    authConnected = true;
  }

  try {
    // 2. Test Realtime Database connection with a lightweight read to .info/connected
    const dbInstance = getDb();
    const snap = await dbInstance.ref(".info/connected").once("value");
    databaseConnected = snap.val() !== null;
  } catch (err) {
    databaseConnected = false;
  }

  const ok = authConnected;

  return {
    ok,
    message: ok
      ? "Firebase Admin services connected and verified."
      : "Firebase Admin initialized but connection test failed.",
    details: {
      authConnected,
      databaseConnected,
      projectId: resolved.config.projectId,
    },
  };
}

// ============================================================================
// Realtime Database Key Utilities
// ============================================================================

/**
 * Encodes an email address into a safe Firebase Realtime Database key.
 * (RTDB keys cannot contain '.', '#', '$', '[', ']', or '/')
 */
export function encodeEmailKey(email: string): string {
  return Buffer.from(email.trim().toLowerCase()).toString("base64url");
}

/**
 * Decodes a base64url-encoded Firebase RTDB key back to the email address.
 */
export function decodeEmailKey(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

/**
 * Replaces illegal Firebase Realtime Database key characters with underscores.
 */
export function sanitizeFirebaseKey(key: string): string {
  return key.replace(/[.#$[\]/]/g, "_");
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  get app() {
    return isFirebaseReady() ? getFirebaseApp() : null;
  },
  db,
  auth,
  storage,
  getDb,
  getAuth,
  getStorage,
  getFirebaseApp,
  isFirebaseReady,
  getFirebaseStatus,
  verifyFirebaseConnection,
  encodeEmailKey,
  decodeEmailKey,
  sanitizeFirebaseKey,
};
