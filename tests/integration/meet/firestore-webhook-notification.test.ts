import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS,
  type CalendarWebhookNotificationClaim,
} from "@/lib/meet/booking-repository";
import {
  FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
  GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS,
} from "@/lib/meet/deadlines";
import { FirestoreBookingRepository } from "@/lib/meet/firestore-booking-repository";
import { getFirestore } from "@/lib/server/firestore";
import { clearFirestore } from "../../helpers/firebase-emulator";

const notificationId = "calendar-webhook-notification-001";
const initialTime = "2026-08-03T12:00:00.000Z";

function claim(processingStartedAt: string, processingOwnerNonce: string): CalendarWebhookNotificationClaim {
  return { processingOwnerNonce, processingStartedAt };
}

function notificationRef() {
  return getFirestore().collection("calendarWebhookNotifications").doc(notificationId);
}

describe("Firestore calendar webhook notification leases", () => {
  beforeEach(async () => clearFirestore());
  afterEach(async () => clearFirestore());

  it("uses a short lease coordinated with the bounded provider deadline", () => {
    expect(CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS).toBe(
      GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS + FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
    );
  });

  it("deduplicates a fresh concurrent notification claim", async () => {
    const repository = new FirestoreBookingRepository();
    const results = await Promise.all([
      repository.claimCalendarWebhookNotification(notificationId, claim(initialTime, "owner-a")),
      repository.claimCalendarWebhookNotification(notificationId, claim(initialTime, "owner-b")),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await notificationRef().get()).data()).toMatchObject({
      processingStartedAt: initialTime,
      status: "processing",
    });
  }, 15_000);

  it("reclaims a stale processing claim, including a legacy claim without lease metadata", async () => {
    const repository = new FirestoreBookingRepository();
    await notificationRef().set({ processingOwnerNonce: "timed-out-owner", processingStartedAt: initialTime, status: "processing" });
    const reclaimedAt = new Date(new Date(initialTime).getTime() + CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS).toISOString();

    await expect(repository.claimCalendarWebhookNotification(notificationId, claim(reclaimedAt, "reclaimer"))).resolves.toBe(true);
    expect((await notificationRef().get()).data()).toMatchObject({
      processingOwnerNonce: "reclaimer",
      processingStartedAt: reclaimedAt,
      status: "processing",
    });

    await notificationRef().set({ status: "processing" });
    await expect(repository.claimCalendarWebhookNotification(notificationId, claim(initialTime, "legacy-reclaimer"))).resolves.toBe(true);
  });

  it("keeps a completed notification idempotently ignored", async () => {
    const repository = new FirestoreBookingRepository();
    const ownerClaim = claim(initialTime, "owner-a");
    await repository.claimCalendarWebhookNotification(notificationId, ownerClaim);
    await repository.completeCalendarWebhookNotification(notificationId, ownerClaim);

    await expect(repository.claimCalendarWebhookNotification(notificationId, claim("2026-08-03T12:02:00.000Z", "retry-owner"))).resolves.toBe(false);
    expect((await notificationRef().get()).data()).toMatchObject({ status: "completed" });
  });

  it("releases a failed claim so Google retry can claim it", async () => {
    const repository = new FirestoreBookingRepository();
    const ownerClaim = claim(initialTime, "owner-a");
    await repository.claimCalendarWebhookNotification(notificationId, ownerClaim);
    await repository.releaseCalendarWebhookNotification(notificationId, ownerClaim);

    await expect(repository.claimCalendarWebhookNotification(notificationId, claim("2026-08-03T12:00:01.000Z", "retry-owner"))).resolves.toBe(true);
  });

  it("requires the claim nonce and timestamp to complete or release", async () => {
    const repository = new FirestoreBookingRepository();
    const ownerClaim = claim(initialTime, "owner-a");
    const intruderClaim = claim(initialTime, "owner-b");
    await repository.claimCalendarWebhookNotification(notificationId, ownerClaim);

    await repository.completeCalendarWebhookNotification(notificationId, intruderClaim);
    await repository.releaseCalendarWebhookNotification(notificationId, intruderClaim);
    await expect(repository.heartbeatCalendarWebhookNotification(notificationId, intruderClaim)).resolves.toBe(false);
    await expect(repository.heartbeatCalendarWebhookNotification(notificationId, claim("2026-08-03T12:00:01.000Z", "owner-a"))).resolves.toBe(true);

    expect((await notificationRef().get()).data()).toMatchObject({
      processingOwnerNonce: "owner-a",
      processingStartedAt: "2026-08-03T12:00:01.000Z",
      status: "processing",
    });
  });
});
