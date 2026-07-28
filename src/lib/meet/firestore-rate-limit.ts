import "server-only";

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { getFirestore } from "@/lib/server/firestore";
import { withBoundedTimeout } from "@/lib/server/bounded-timeout";
import { FIRESTORE_RATE_LIMIT_TIMEOUT_MS } from "./deadlines";

export { FIRESTORE_RATE_LIMIT_TIMEOUT_MS } from "./deadlines";

export async function consumeFirestoreFixedWindow(
  identity: string,
  maxRequests: number,
  windowMs: number,
  timeoutMs = FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = createHash("sha256").update(`${identity}:${windowStart}`).digest("hex");
  const ref = getFirestore().collection("rateLimits").doc(key);

  return withBoundedTimeout(
    () => getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
      if (count >= maxRequests) return false;
      tx.set(ref, {
        count: count + 1,
        expiresAt: new Date(windowStart + windowMs),
        windowStart,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    }),
    timeoutMs,
  );
}
