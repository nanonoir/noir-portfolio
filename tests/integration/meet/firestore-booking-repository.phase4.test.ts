import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FirestoreBookingRepository } from "@/lib/meet/firestore-booking-repository";
import { ActionService } from "@/lib/meet/action-service";
import { FirestoreActionTokenRepository } from "@/lib/meet/firestore-action-token-repository";
import { MockAvailabilityRepository } from "@/lib/meet/availability-repository";
import { GoogleCalendarMockProvider } from "@/lib/meet/calendar-provider";
import { ResendMockProvider } from "@/lib/meet/email-provider";
import { getFirestore } from "@/lib/server/firestore";
import { clearFirestore } from "../../helpers/firebase-emulator";
import { createBookingRecordFixture } from "../../helpers/booking-factory";

const repository = new FirestoreBookingRepository();
const oldSlot = "2026-08-04T10:00:00.000Z" as never;
const newSlot = "2026-08-05T11:00:00.000Z" as never;

function idempotencyDocumentId(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

describe("Firestore emulator booking repository transactions", () => {
  beforeEach(async () => clearFirestore());
  afterEach(async () => clearFirestore());

  it("serializes concurrent creates, replays the first record, and retains legacy lookup paths", async () => {
    const key = "00000000-0000-4000-8000-000000000101";
    const first = createBookingRecordFixture({ id: "booking-create-a", idempotencyKey: key });
    const second = createBookingRecordFixture({ id: "booking-create-b", idempotencyKey: key });

    const [created, replayed] = await Promise.all([repository.create(first), repository.create(second)]);

    expect(created.id).toBe(replayed.id);
    expect([first.id, second.id]).toContain(created.id);
    expect((await getFirestore().collection("meetings").get()).size).toBe(1);
    expect(await repository.findByIdempotencyKey(key)).toMatchObject({ id: created.id });
    expect(await getFirestore().collection("meetingIdempotency").doc(idempotencyDocumentId(key)).get()).toMatchObject({ exists: true });

    await repository.updateProviderDetails(created.id, {
      calendarEventId: "calendar-event-101",
      googleMeetUrl: "https://meet.google.com/integration-101",
    });
    expect(await repository.findByCalendarEventId("calendar-event-101")).toMatchObject({ id: created.id });

    const legacyKey = "00000000-0000-4000-8000-000000000102";
    const legacy = createBookingRecordFixture({ id: "booking-legacy", idempotencyKey: legacyKey });
    await getFirestore().collection("meetings").doc(legacy.id).set({
      ...legacy,
      emailNormalized: "visitor@example.com",
    });
    const legacyReplay = await repository.create(createBookingRecordFixture({ id: "booking-legacy-duplicate", idempotencyKey: legacyKey }));

    expect(legacyReplay.id).toBe(legacy.id);
    expect((await getFirestore().collection("meetings").doc(legacy.id).get()).data()).toMatchObject({
      emailNormalized: "visitor@example.com",
      idempotencyKey: legacyKey,
    });
  });

  it("persists proposal, provider delivery, details, and audit updates transactionally", async () => {
    const record = createBookingRecordFixture({ id: "booking-delivery", idempotencyKey: "00000000-0000-4000-8000-000000000103" });
    await repository.create(record);

    const proposal = await repository.proposeAlternative(record.id, {
      now: new Date().toISOString(),
      proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: "UTC" as never },
    });
    expect(proposal).toMatchObject({ success: true, record: { proposalVersion: "2", status: "reschedule_proposed" } });

    await repository.updateProviderDelivery(record.id, "calendar", { errorCode: "CALENDAR_TIMEOUT", status: "failed" });
    await repository.updateProviderDelivery(record.id, "calendar", { status: "completed" });
    await repository.updateProviderDetails(record.id, {
      calendarEventId: "calendar-event-103",
      googleMeetUrl: "https://meet.google.com/integration-103",
    });

    const stored = await repository.findById(record.id);
    expect(stored).toMatchObject({
      calendarDelivery: { attempts: 3, status: "completed" },
      calendarEventId: "calendar-event-103",
      googleMeetUrl: "https://meet.google.com/integration-103",
      proposedSlot: { date: "2026-08-05", time: "11:00" },
    });
    expect(stored?.auditLog.map((event) => event.action)).toEqual([
      "alternative_proposed",
      "provider_failed",
      "provider_recovered",
    ]);

    const beforeInvalidTransition = stored?.auditLog;
    expect(await repository.updateStatus(record.id, "confirmed")).toMatchObject({
      error: "INVALID_STATUS_TRANSITION",
      success: false,
    });
    expect((await repository.findById(record.id))?.auditLog).toEqual(beforeInvalidTransition);
  });

  it("rejects slot conflicts and atomically releases old and terminal reservations", async () => {
    const first = createBookingRecordFixture({ id: "booking-slot-a", idempotencyKey: "00000000-0000-4000-8000-000000000104" });
    const second = createBookingRecordFixture({ id: "booking-slot-b", idempotencyKey: "00000000-0000-4000-8000-000000000105" });
    await Promise.all([repository.create(first), repository.create(second)]);

    const [firstReservation, secondReservation] = await Promise.all([
      repository.reserveSlotForMeeting({ meetingId: first.id, slotIdentity: oldSlot, toStatus: "owner_confirmed" }),
      repository.reserveSlotForMeeting({ meetingId: second.id, slotIdentity: oldSlot, toStatus: "owner_confirmed" }),
    ]);
    expect([firstReservation.success, secondReservation.success].filter(Boolean)).toHaveLength(1);
    expect(await getFirestore().collection("reservedSlots").doc(oldSlot).get()).toMatchObject({ exists: true });

    const ownerId = firstReservation.success ? first.id : second.id;
    const waitingId = ownerId === first.id ? second.id : first.id;
    await repository.proposeAlternative(ownerId, {
      proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: "UTC" as never },
    });
    expect(await repository.reserveSlotForMeeting({ meetingId: ownerId, slotIdentity: newSlot, toStatus: "owner_confirmed" })).toMatchObject({ success: true });
    expect(await getFirestore().collection("reservedSlots").doc(oldSlot).get()).toMatchObject({ exists: false });
    expect((await getFirestore().collection("reservedSlots").doc(newSlot).get()).data()).toMatchObject({ meetingId: ownerId });

    expect(await repository.updateStatus(ownerId, "declined")).toMatchObject({ success: true });
    expect(await getFirestore().collection("reservedSlots").doc(newSlot).get()).toMatchObject({ exists: false });
    expect(await repository.reserveSlotForMeeting({ meetingId: waitingId, slotIdentity: newSlot, toStatus: "owner_confirmed" })).toMatchObject({ success: true });
  }, 15_000);

  it("persists a decline audit when no optional decline reason was submitted", async () => {
    const record = createBookingRecordFixture({
      id: "booking-decline-without-reason",
      idempotencyKey: "00000000-0000-4000-8000-000000000106",
    });
    await repository.create(record);

    const actionService = new ActionService(
      repository,
      new MockAvailabilityRepository(),
      () => new Date(),
      new FirestoreActionTokenRepository(),
      new GoogleCalendarMockProvider(),
      new ResendMockProvider(),
    );
    const [declineToken] = await actionService.issueTokens({
      actions: ["decline"],
      actor: "owner",
      meetingId: record.id,
      proposalVersion: record.proposalVersion,
      proposedSlotStartISO: null,
    });

    await expect(actionService.consumeAction({
      expectedAction: "decline",
      meetingId: record.id,
      rawToken: declineToken!.token,
    })).resolves.toMatchObject({ meeting: { status: "declined" }, status: "ok" });
  });
});
