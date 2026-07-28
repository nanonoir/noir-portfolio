import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { ACTION_TOKEN_PROCESSING_LEASE_MS, CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS } from "./deadlines";
import { isFirebaseConfigured } from "@/lib/server/env";
import { getFirestore } from "@/lib/server/firestore";

const HEALTH_READ_TIMEOUT_MS = 750;
const HEALTH_QUERY_LIMIT = 100;

export type HealthAggregateStatus = "available" | "unavailable";

export interface MeetHealthAggregates {
  actionTokenLeases: { stale: number | null; status: HealthAggregateStatus };
  deliveries: {
    calendarFailed: number | null;
    emailFailed: number | null;
    retryable: number | null;
    status: HealthAggregateStatus;
  };
  webhookNotificationLeases: { stale: number | null; status: HealthAggregateStatus };
}

const unavailableAggregates = (): MeetHealthAggregates => ({
  actionTokenLeases: { stale: null, status: "unavailable" },
  deliveries: { calendarFailed: null, emailFailed: null, retryable: null, status: "unavailable" },
  webhookNotificationLeases: { stale: null, status: "unavailable" },
});

function withHealthReadTimeout<T>(read: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Health aggregate read timed out.")), HEALTH_READ_TIMEOUT_MS);
    read.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error: unknown) => { clearTimeout(timeout); reject(error); },
    );
  });
}

/**
 * Reads bounded, count-only operational metadata. Query limits intentionally
 * cap work per health request; a count of 100 means "100 or more", never an
 * unbounded scan. No document IDs or booking fields leave this module.
 */
export async function getMeetHealthAggregates(now = new Date()): Promise<MeetHealthAggregates> {
  if (!isFirebaseConfigured()) return unavailableAggregates();

  try {
    const db = getFirestore();
    const actionLeaseCutoff = Timestamp.fromMillis(now.getTime() - ACTION_TOKEN_PROCESSING_LEASE_MS);
    const webhookLeaseCutoff = Timestamp.fromMillis(now.getTime() - CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS);

    const [actionTokens, webhookNotifications, calendarDeliveries, emailDeliveries] = await withHealthReadTimeout(
      Promise.all([
        db.collectionGroup("actionTokens").where("processingStartedAt", "<=", actionLeaseCutoff).limit(HEALTH_QUERY_LIMIT).get(),
        db.collection("calendarWebhookNotifications").where("processingStartedAt", "<=", webhookLeaseCutoff).limit(HEALTH_QUERY_LIMIT).get(),
        db.collection("meetings").where("calendarDelivery.status", "==", "failed").limit(HEALTH_QUERY_LIMIT).get(),
        db.collection("meetings").where("emailDelivery.status", "==", "failed").limit(HEALTH_QUERY_LIMIT).get(),
      ]),
    );

    const staleActionTokens = actionTokens.docs.filter((doc) => doc.data().result?.status === "processing").length;
    const staleWebhookNotifications = webhookNotifications.docs.filter((doc) => doc.data().status === "processing").length;
    const calendarFailed = calendarDeliveries.size;
    const emailFailed = emailDeliveries.size;

    return {
      actionTokenLeases: { stale: staleActionTokens, status: "available" },
      deliveries: { calendarFailed, emailFailed, retryable: calendarFailed + emailFailed, status: "available" },
      webhookNotificationLeases: { stale: staleWebhookNotifications, status: "available" },
    };
  } catch {
    return unavailableAggregates();
  }
}
