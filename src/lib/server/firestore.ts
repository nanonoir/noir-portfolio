import "server-only";
import { getFirestore as adminGetFirestore, type Firestore } from "firebase-admin/firestore";

import { getFirebaseAdminApp, resetFirebaseAdminForEmulatorTests } from "./firebase-admin";

/**
 * Lazy Firestore accessor built on the Phase 1 Firebase Admin app.
 *
 * Server-only: Firestore is reached exclusively through Firebase Admin SDK on the
 * server. No client path can import this module. Phase 2 wires
 * `FirestoreBookingRepository` on top of this accessor while preserving the
 * `BookingRepository` port so the booking service flow stays unchanged.
 */

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
