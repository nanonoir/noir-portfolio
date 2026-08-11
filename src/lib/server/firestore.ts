import "server-only";
import { getFirestore as adminGetFirestore, type Firestore } from "firebase-admin/firestore";

import { getFirebaseAdminApp, resetFirebaseAdminForEmulatorTests } from "./firebase-admin";

/** Lazy server-only Firestore accessor backed by the Admin SDK. */

let cachedFirestore: Firestore | null = null;

export function getFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  cachedFirestore = adminGetFirestore(getFirebaseAdminApp());
  return cachedFirestore;
}

/** Terminates Admin SDK handles after an emulator test worker completes. */
export async function resetFirestoreForEmulatorTests(): Promise<void> {
  if (process.env.NODE_ENV !== "test" || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Firestore cleanup is available only to Firestore emulator tests.");
  }

  const firestore = cachedFirestore;
  cachedFirestore = null;

  try {
    if (firestore) {
      await firestore.terminate();
    }
  } finally {
    await resetFirebaseAdminForEmulatorTests();
  }
}
