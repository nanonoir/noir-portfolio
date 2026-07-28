import "server-only";
import { cert, deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";

import { getEnv } from "./env";

/**
 * Lazy Firebase Admin SDK initialization.
 *
 * The Admin SDK is initialized only when first requested by a server module
 * (e.g. a future Firestore repository). Phase 1 exposes the entry point so
 * later phases can inject persistence without re-implementing bootstrap logic.
 *
 * Firestore is not touched here and no client bundle can reach this module:
 * `import "server-only"` guarantees a build-time failure if it ever moves to a
 * client graph, and the credentials come only from server env vars.
 */

let cachedApp: App | null = null;

const TEST_FIREBASE_PROJECT_ID = "demo-noir-portfolio";

function isFirestoreEmulatorTest(): boolean {
  return (process.env.NODE_ENV === "test" || process.env.MEET_BACKEND_E2E === "1")
    && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

/** Test-only lifecycle cleanup for emulator workers. */
export async function resetFirebaseAdminForEmulatorTests(): Promise<void> {
  if (!isFirestoreEmulatorTest()) {
    throw new Error("Firebase Admin cleanup is available only to Firestore emulator tests.");
  }

  const app = cachedApp;
  cachedApp = null;

  if (app) {
    await deleteApp(app);
  }
}

export function getFirebaseAdminApp(): App {
  if (cachedApp) return cachedApp;

  const projectId = getEnv("FIREBASE_PROJECT_ID");

  if (isFirestoreEmulatorTest()) {
    if (projectId !== TEST_FIREBASE_PROJECT_ID) {
      throw new Error(`Firestore emulator tests require FIREBASE_PROJECT_ID=${TEST_FIREBASE_PROJECT_ID}.`);
    }

    if (getApps().length > 0) {
      cachedApp = getApps()[0]!;
      return cachedApp;
    }

    // The emulator uses FIRESTORE_EMULATOR_HOST and does not require a service
    // account. Keeping this branch test-only ensures production still requires
    // explicit certificate credentials.
    cachedApp = initializeApp({ projectId });
    return cachedApp;
  }

  const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = getEnv("FIREBASE_PRIVATE_KEY");

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Firebase Admin SDK cannot initialize: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be configured.",
    );
  }

  const serviceAccount = {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };

  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }

  cachedApp = initializeApp({ credential: cert(serviceAccount) });
  return cachedApp;
}
