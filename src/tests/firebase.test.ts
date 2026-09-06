import assert from "node:assert/strict";
import {
  isFirebaseReady,
  getFirebaseStatus,
  getFirebaseApp,
  getDb,
  getAuth,
  getStorage,
  db,
  auth,
  encodeEmailKey,
  decodeEmailKey,
  sanitizeFirebaseKey,
  verifyFirebaseConnection,
} from "../../firebase/init.js";

async function runFirebaseTests() {
  console.log("==================================================");
  console.log(" Starting Firebase Admin SDK Validation Suite");
  console.log("==================================================\n");

  // Test 1: Configuration status
  console.log("[Test 1] Inspecting Firebase Admin Status...");
  const status = getFirebaseStatus();
  console.log("Firebase Status:", {
    isReady: status.isReady,
    projectId: status.projectId,
    clientEmail: status.clientEmail ? status.clientEmail.replace(/(.{3}).+(@.+)/, "$1***$2") : undefined,
    databaseURL: status.databaseURL,
    storageBucket: status.storageBucket,
    source: status.initSource,
  });

  assert.equal(typeof status.isReady, "boolean");
  assert.ok(status.initSource, "Init source should be defined");
  console.log("✓ Test 1 Passed: Status metadata successfully resolved.\n");

  // Test 2: Realtime Database Key Encoding
  console.log("[Test 2] Testing RTDB Key Encoding & Decoding...");
  const testEmail = "user.name+test@example.com";
  const encoded = encodeEmailKey(testEmail);
  const decoded = decodeEmailKey(encoded);
  assert.equal(decoded, testEmail.toLowerCase(), "Decoded email must match original lowercased email");
  assert.ok(!/[.#$[\]/]/.test(encoded), "Encoded key must not contain RTDB illegal characters");

  const sanitized = sanitizeFirebaseKey("user.info#1$test[2]/data");
  assert.ok(!/[.#$[\]/]/.test(sanitized), "Sanitized key must not contain RTDB illegal characters");
  console.log("✓ Test 2 Passed: Key encoding/decoding and sanitization verified.\n");

  // Test 3: Firebase Admin App Instance & Service getters
  if (isFirebaseReady()) {
    console.log("[Test 3] Firebase is configured with active credentials. Validating instances...");
    const app = getFirebaseApp();
    assert.ok(app, "Firebase App instance must be returned");

    const rtdb = getDb();
    assert.ok(rtdb, "RTDB Database instance must be returned");
    assert.equal(typeof rtdb.ref, "function", "db.ref must be a function");

    const authInstance = getAuth();
    assert.ok(authInstance, "Auth instance must be returned");
    assert.equal(typeof authInstance.createUser, "function", "auth.createUser must be a function");

    const storageInstance = getStorage();
    assert.ok(storageInstance, "Storage instance must be returned");

    // Test proxies
    assert.equal(typeof db.ref, "function", "Proxy db.ref must be callable");
    assert.equal(typeof auth.createUser, "function", "Proxy auth.createUser must be callable");

    console.log("✓ Test 3 Passed: App and all services (Database, Auth, Storage) initialized.\n");

    // Test 4: Live connection verification
    console.log("[Test 4] Performing live connection verification...");
    const conn = await verifyFirebaseConnection();
    console.log("Connection verification result:", conn);
    assert.ok(conn.details.authConnected || conn.details.databaseConnected, "At least one service should connect");
    console.log("✓ Test 4 Passed: Connectivity check completed successfully.\n");
  } else {
    console.log("[Test 3 & 4] Firebase running in unconfigured/offline mode. Validating proxy error handling...");
    assert.throws(
      () => {
        db.ref("test");
      },
      /Firebase is not initialized/,
      "Proxy db should throw helpful error when unconfigured"
    );
    console.log("✓ Offline Mode Passed: Informative error thrown on unconfigured access.\n");
  }

  console.log("==================================================");
  console.log(" All Firebase Admin Tests Completed Successfully!");
  console.log("==================================================\n");
}

runFirebaseTests().catch((err) => {
  console.error("Firebase Test Suite failed:", err);
  process.exit(1);
});
