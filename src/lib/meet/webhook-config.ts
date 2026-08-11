import "server-only";

import { getFirestore } from "@/lib/server/firestore";
import { isFirebaseConfigured } from "@/lib/server/env";

export type WebhookHealth = "active" | "configured" | "expired" | "unavailable";

const WEBHOOK_HEALTH_READ_TIMEOUT_MS = 750;

function withWebhookHealthReadTimeout<T>(read: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Webhook health read timed out.")), WEBHOOK_HEALTH_READ_TIMEOUT_MS);
    read.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error: unknown) => { clearTimeout(timeout); reject(error); },
    );
  });
}

export async function getGoogleWebhookHealth(): Promise<{ expirationAt: string | null; status: WebhookHealth }> {
  if (!isFirebaseConfigured()) return { expirationAt: null, status: "unavailable" };
  try {
    const snap = await withWebhookHealthReadTimeout(getFirestore().collection("operations").doc("googleCalendarWebhook").get());
    if (!snap.exists) return { expirationAt: null, status: "configured" };
    const raw = snap.data()?.expirationAt;
    const expirationAt = raw && typeof raw.toDate === "function" ? raw.toDate().toISOString() : null;
    return { expirationAt, status: expirationAt && new Date(expirationAt).getTime() > Date.now() ? "active" : "expired" };
  } catch {
    return { expirationAt: null, status: "unavailable" };
  }
}

/** Manual watch-registration tooling persists only non-secret channel metadata. */
export async function saveGoogleWebhookChannel(input: { channelId: string; resourceId: string; expirationAt: Date }): Promise<void> {
  await getFirestore().collection("operations").doc("googleCalendarWebhook").set({
    channelId: input.channelId,
    resourceId: input.resourceId,
    expirationAt: input.expirationAt,
    updatedAt: new Date(),
  });
}
