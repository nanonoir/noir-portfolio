import "server-only";

import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";

import {
  appendProviderAuditEvent,
  proposeAlternativeBooking,
  transitionBooking,
  transitionBookingWithAcceptedProposal,
  type BookingTransitionOptions,
  type ProposeAlternativeOptions,
} from "./booking-lifecycle";
import { BOOKING_AUDIT_ACTIONS, type BookingAuditEvent } from "./audit-events";
import { type BookingRecord, type BookingTimestamp } from "./booking-model";
import { MEETING_ERROR_CODES } from "./codes";
import type { ProviderDeliveryState } from "./dto";
import type { MeetingStatus } from "./domain";
import {
  BOOKING_REPOSITORY_ERROR_CODES,
  CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS,
  type BookingRepository,
  type BookingRepositoryResult,
  type CalendarWebhookNotificationClaim,
  type ProviderDeliveryUpdate,
  type ProviderName,
  type ReserveSlotForMeetingInput,
  type SlotReservationInput,
  type SlotReservationResult,
} from "./booking-repository";
import { getFirestore } from "@/lib/server/firestore";
import { normalizeEmail } from "./firestore-collections";
import { addMeetingDuration } from "./duration";

/**
 * Firestore-backed BookingRepository.
 *
 * Implements the same port as `MockBookingRepository` so the booking service
 * flow is unchanged. Phase 2 PRD §13.2 exit criteria:
 *  - requests survive process restarts → Firestore persistence;
 *  - same idempotency key replays safely → `reserveSlotIfAvailable` reads
 *    `meetings` by idempotencyKey inside the transaction and replays;
 *  - same key with a different canonical payload returns 409
 *    `IDEMPOTENCY_CONFLICT` → the service compares hash in `handleReplay` and
 *    the transaction persists `payloadHash` for auditability;
 *  - two confirmations for the same UTC slot result in exactly one reservation
 *    → `reservedSlots/{slotIdentity}` is created atomically inside the same
 *    transaction that creates the meeting document;
 *  - no client has direct Firestore access → server-only module via Admin SDK.
 *
 * `requested` never reserves a slot in the production semantic model (PRD
 * §3.2). The booking service is the only caller of `reserveSlotIfAvailable` in
 * the current flow and the existing service contract treats that call as the
 * durable create+reserve boundary; this adapter honors that contract. Phase 4
 * will re-route reservation to the confirm action; the same atomic transaction
 * will still apply.
 */

const SLOT_RELEASE_STATUSES: ReadonlySet<MeetingStatus> = new Set<MeetingStatus>([
  "cancelled",
  "declined",
  "expired",
]);

type MeetingStoredDoc = {
  auditLog: BookingAuditEvent[];
  calendarDelivery: ProviderDeliveryState;
  calendarEventId: string | null;
  createdAt: Timestamp | string;
  emailDelivery: ProviderDeliveryState;
  expiresAt: Timestamp | string | null;
  googleMeetUrl: string | null;
  id: string;
  identity: BookingRecord["identity"];
  idempotencyKey: string;
  locale: BookingRecord["locale"];
  meeting: BookingRecord["meeting"];
  origin: BookingRecord["origin"];
  ownerNotificationRecovery?: string | null;
  payloadHash: BookingRecord["payloadHash"];
  proposalVersion: string;
  proposedSlot: BookingRecord["proposedSlot"];
  previousRequest: BookingRecord["previousRequest"];
  reason: BookingRecord["reason"];
  relatedService: BookingRecord["relatedService"];
  status: MeetingStatus;
  updatedAt: Timestamp | string;
  visitorTimezone: BookingRecord["visitorTimezone"];
  emailNormalized: string;
};

type IdempotencyStoredDoc = {
  meetingId: string;
};

const CALENDAR_WEBHOOK_NOTIFICATION_STATUS = {
  COMPLETED: "completed",
  PROCESSING: "processing",
} as const;

type CalendarWebhookNotificationStoredDoc = {
  processingOwnerNonce?: string | null;
  processingStartedAt?: Timestamp | string | null;
  status?: string;
};

export class FirestoreBookingRepository implements BookingRepository {
  async claimCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const db = getFirestore();
    const ref = db.collection("calendarWebhookNotifications").doc(notificationId);

    return db.runTransaction(async (tx: Transaction) => {
      const existing = await tx.get(ref);
      const current = existing.exists
        ? existing.data() as CalendarWebhookNotificationStoredDoc
        : null;
      if (current?.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.COMPLETED) return false;
      if (current?.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING && !isCalendarWebhookNotificationLeaseStale(current.processingStartedAt, claim.processingStartedAt)) return false;
      tx.set(ref, {
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        processingOwnerNonce: claim.processingOwnerNonce,
        processingStartedAt: claim.processingStartedAt,
        status: CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING,
      }, { merge: true });
      return true;
    });
  }

  async completeCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const db = getFirestore();
    const ref = db.collection("calendarWebhookNotifications").doc(notificationId);
    return db.runTransaction(async (tx: Transaction) => {
      const existing = await tx.get(ref);
      if (!existing.exists || !matchesCalendarWebhookNotificationClaim(existing.data() as CalendarWebhookNotificationStoredDoc, claim)) return false;
      tx.set(ref, {
        completedAt: FieldValue.serverTimestamp(),
        processingOwnerNonce: null,
        processingStartedAt: null,
        status: CALENDAR_WEBHOOK_NOTIFICATION_STATUS.COMPLETED,
      }, { merge: true });
      return true;
    });
  }

  async create(record: BookingRecord): Promise<BookingRecord> {
    const db = getFirestore();
    const idempotencyRef = db.collection("meetingIdempotency").doc(idempotencyDocumentId(record.idempotencyKey));
    const meetingRef = db.collection("meetings").doc(record.id);
    const legacyLookup = db.collection("meetings").where("idempotencyKey", "==", record.idempotencyKey).limit(1);

    try {
      return await db.runTransaction(async (tx: Transaction) => {
      // All reads complete before creation writes. The deterministic guard doc
      // serializes concurrent requests even though each request creates a UUID
      // meeting document.
      const idempotencySnap = await tx.get(idempotencyRef);
      const legacySnap = idempotencySnap.exists ? null : await tx.get(legacyLookup);

      if (idempotencySnap.exists) {
        const stored = idempotencySnap.data() as IdempotencyStoredDoc;
        const existingSnap = await tx.get(db.collection("meetings").doc(stored.meetingId));
        if (existingSnap.exists) return this.fromMeetingDoc(existingSnap.data() as MeetingStoredDoc);
      }
      if (legacySnap && !legacySnap.empty) {
        return this.fromMeetingDoc(legacySnap.docs[0]!.data() as MeetingStoredDoc);
      }

      const now = FieldValue.serverTimestamp();
      tx.create(idempotencyRef, { meetingId: record.id, createdAt: now });
      tx.create(meetingRef, {
        ...this.toCreateDoc(record),
        createdAt: now,
        updatedAt: now,
      });
        return record;
      });
    } catch (error) {
      // The guard is the canonical idempotency owner. Firestore normally retries
      // a read/create collision, but an emulator can surface an already-exists
      // error directly. Never retry the meeting write independently: reread the
      // guard and return its winner so a collision cannot create a second record.
      const guard = await idempotencyRef.get();
      if (guard.exists) {
        const stored = guard.data() as IdempotencyStoredDoc;
        const winner = await db.collection("meetings").doc(stored.meetingId).get();
        if (winner.exists) return this.fromMeetingDoc(winner.data() as MeetingStoredDoc);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const db = getFirestore();
    const snap = await db.collection("meetings").doc(id).get();
    if (!snap.exists) return null;
    return this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
  }

  async findByCalendarEventId(calendarEventId: string): Promise<BookingRecord | null> {
    const db = getFirestore();
    const query = await db
      .collection("meetings")
      .where("calendarEventId", "==", calendarEventId)
      .limit(1)
      .get();
    if (query.empty) return null;
    return this.fromMeetingDoc(query.docs[0]!.data() as MeetingStoredDoc);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<BookingRecord | null> {
    const db = getFirestore();
    const query = await db
      .collection("meetings")
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (query.empty) return null;
    return this.fromMeetingDoc(query.docs[0]!.data() as MeetingStoredDoc);
  }

  async reserveSlotIfAvailable(input: SlotReservationInput): Promise<SlotReservationResult> {
    const db = getFirestore();
    const { record, slotIdentity } = input;

    return db.runTransaction(async (tx: Transaction) => {
      const idempotencyQuery = db
        .collection("meetings")
        .where("idempotencyKey", "==", record.idempotencyKey)
        .limit(1);
      const existingSnap = await tx.get(idempotencyQuery);

      if (!existingSnap.empty) {
        const existing = this.fromMeetingDoc(existingSnap.docs[0]!.data() as MeetingStoredDoc);
        return { record: existing, replayed: true, success: true } as const;
      }

      const slotRef = db.collection("reservedSlots").doc(slotIdentity);
      const slotSnap = await tx.get(slotRef);
      if (slotSnap.exists) {
        return { error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false } as const;
      }

      const now = FieldValue.serverTimestamp();
      tx.set(db.collection("meetings").doc(record.id), {
        ...this.toCreateDoc(record),
        createdAt: now,
        updatedAt: now,
      });

      tx.set(slotRef, {
        endISO: this.computeSlotEndISO(slotIdentity),
        idempotencyKey: record.idempotencyKey,
        meetingId: record.id,
        payloadHash: record.payloadHash,
        reservedAt: now,
        startISO: slotIdentity,
        timezone: record.visitorTimezone,
      });

      return { record, replayed: false, success: true } as const;
    });
  }

  async recordIdempotencyReplay(id: string): Promise<BookingRecord | null> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const updatedAt = new Date().toISOString();
      const updatedRecord = appendProviderAuditEvent(
        { ...current, updatedAt },
        BOOKING_AUDIT_ACTIONS.IDEMPOTENCY_REPLAY,
        { now: updatedAt, payload: { idempotencyKey: current.idempotencyKey } },
      );
      tx.update(ref, {
        auditLog: updatedRecord.auditLog as BookingAuditEvent[],
        updatedAt: FieldValue.serverTimestamp(),
      });
      return updatedRecord;
    });
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    options: BookingTransitionOptions = {},
  ): Promise<BookingRepositoryResult> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    const slotQuery = db.collection("reservedSlots").where("meetingId", "==", id).limit(1);

    return db.runTransaction(async (tx: Transaction) => {
      // ── All transaction reads MUST happen before any write. ──
      const snap = await tx.get(ref);
      const slotSnap = await tx.get(slotQuery);
      // Store the slot DocumentReference before any write so `tx.delete` never
      // has to touch the snapshot after a write.
      const slotDocRef = slotSnap.empty ? null : slotSnap.docs[0]!.ref;
      // ── Writes start here. No `tx.get` from this line onward. ──

      if (!snap.exists) {
        return { error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND, success: false } as const;
      }
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const result = transitionBooking(current, status, options);
      if (!result.success) return result;

      tx.update(ref, {
        ...this.toUpdateFields(result.record),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (SLOT_RELEASE_STATUSES.has(status) && slotDocRef !== null) {
        tx.delete(slotDocRef);
      }
      return result;
    });
  }

  async reserveSlotForMeeting(input: ReserveSlotForMeetingInput): Promise<BookingRepositoryResult> {
    const db = getFirestore();
    const meetingRef = db.collection("meetings").doc(input.meetingId);
    const slotRef = db.collection("reservedSlots").doc(input.slotIdentity);
    // Look up any existing reservation owned by this meeting so the same
    // transaction can release it on reschedule.
    const priorSlotsQuery = db
      .collection("reservedSlots")
      .where("meetingId", "==", input.meetingId)
      .limit(10);

    return db.runTransaction(async (tx: Transaction) => {
      // ── All transaction reads MUST happen before any write. ──
      const meetingSnap = await tx.get(meetingRef);
      const slotSnap = await tx.get(slotRef);
      const priorSlotsSnap = await tx.get(priorSlotsQuery);
      // Capture the prior slot DocumentReferences before any write so we can
      // delete them without re-reading after writes.
      const priorSlotDocRefs = priorSlotsSnap.docs
        .map((doc) => doc.ref)
        .filter((ref) => ref.path !== slotRef.path);
      // ── Writes start here. No `tx.get` from this line onward. ──

      if (!meetingSnap.exists) {
        return {
          error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND,
          success: false,
        } as const;
      }
      const current = this.fromMeetingDoc(meetingSnap.data() as MeetingStoredDoc);

      // Conflict check: slot already owned by a DIFFERENT meeting → unavailable.
      if (slotSnap.exists) {
        const slotData = slotSnap.data() as { meetingId?: string };
        if (slotData.meetingId !== input.meetingId) {
          return { error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false } as const;
        }
        // Slot already belongs to this meeting; idempotent — fall through and
        // perform the transition if the status allows it.
      }

      const transitionOptions = input.transitionOptions ?? {};
      const result = transitionBookingWithAcceptedProposal(current, input.toStatus, transitionOptions);
      if (!result.success) return result;

      tx.update(meetingRef, {
        ...this.toUpdateFields(result.record),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Phase 5 atomic reservation of the new slot OR upsert (if it was
      // already owned by this meeting, keep it but refresh timestamp + payload
      // hash). Use `set` with merge semantics by writing through `tx.set(slotRef, ..., { merge: true })`.
      tx.set(
        slotRef,
        {
          endISO: this.computeSlotEndISO(input.slotIdentity),
          idempotencyKey: current.idempotencyKey,
          meetingId: input.meetingId,
          payloadHash: current.payloadHash,
          reservedAt: FieldValue.serverTimestamp(),
          startISO: input.slotIdentity,
          timezone: current.visitorTimezone,
        },
        { merge: true },
      );

      // Release any prior reservation owned by this meeting that no longer
      // matches the new slot identity.
      for (const ref of priorSlotDocRefs) {
        tx.delete(ref);
      }

      return result;
    });
  }

  async heartbeatCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const db = getFirestore();
    const ref = db.collection("calendarWebhookNotifications").doc(notificationId);
    return db.runTransaction(async (tx: Transaction) => {
      const existing = await tx.get(ref);
      if (!existing.exists || !hasCalendarWebhookNotificationOwner(existing.data() as CalendarWebhookNotificationStoredDoc, claim)) return false;
      tx.update(ref, { processingStartedAt: claim.processingStartedAt });
      return true;
    });
  }

  async releaseCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<void> {
    const db = getFirestore();
    const ref = db.collection("calendarWebhookNotifications").doc(notificationId);
    await db.runTransaction(async (tx: Transaction) => {
      const existing = await tx.get(ref);
      if (!existing.exists || !matchesCalendarWebhookNotificationClaim(existing.data() as CalendarWebhookNotificationStoredDoc, claim)) return;
      tx.delete(ref);
    });
  }

  async updateProviderDetails(
    id: string,
    details: Pick<BookingRecord, "calendarEventId" | "googleMeetUrl">,
  ): Promise<BookingRecord | null> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const updatedAt = new Date().toISOString();
      const providerWasRecovered = current.calendarDelivery.status === "failed";
      const updatedRecord: BookingRecord = {
        ...current,
        ...details,
        calendarDelivery: {
          ...current.calendarDelivery,
          attempts: current.calendarDelivery.attempts + 1,
          status: "completed",
        },
        updatedAt,
      };
      const recordWithAudit = providerWasRecovered
        ? appendProviderAuditEvent(updatedRecord, BOOKING_AUDIT_ACTIONS.PROVIDER_RECOVERED, {
          now: updatedAt,
          payload: { provider: "calendar" },
        })
        : updatedRecord;

      tx.update(ref, {
        calendarEventId: recordWithAudit.calendarEventId,
        googleMeetUrl: recordWithAudit.googleMeetUrl,
        calendarDelivery: recordWithAudit.calendarDelivery,
        auditLog: recordWithAudit.auditLog as BookingAuditEvent[],
        updatedAt: FieldValue.serverTimestamp(),
      });
      return recordWithAudit;
    });
  }

  async updateOwnerNotificationRecovery(id: string, recovery: string | null): Promise<BookingRecord | null> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const updatedRecord = { ...current, ownerNotificationRecovery: recovery, updatedAt: new Date().toISOString() };
      tx.update(ref, { ownerNotificationRecovery: recovery, updatedAt: FieldValue.serverTimestamp() });
      return updatedRecord;
    });
  }

  async updateProviderDelivery(
    id: string,
    provider: ProviderName,
    update: ProviderDeliveryUpdate,
  ): Promise<BookingRecord | null> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const updatedAt = new Date().toISOString();
      const deliveryKey = provider === "calendar" ? "calendarDelivery" : "emailDelivery";
      const previousDelivery = current[deliveryKey] as ProviderDeliveryState;
      const delivery: ProviderDeliveryState = {
        attempts: previousDelivery.attempts + 1,
        ...(previousDelivery.lastError ? { lastError: previousDelivery.lastError } : {}),
        ...(update.status === "failed" && update.errorCode
          ? { lastError: { code: update.errorCode, occurredAt: updatedAt } }
          : {}),
        status: update.status,
      };
      const updatedRecord = { ...current, [deliveryKey]: delivery, updatedAt } as BookingRecord;
      const action =
        update.status === "failed"
          ? BOOKING_AUDIT_ACTIONS.PROVIDER_FAILED
          : previousDelivery.status === "failed"
            ? BOOKING_AUDIT_ACTIONS.PROVIDER_RECOVERED
            : null;
      const recordWithAudit = action
        ? appendProviderAuditEvent(updatedRecord, action, {
          now: updatedAt,
          payload: { provider, ...(update.errorCode ? { code: update.errorCode } : {}) },
        })
        : updatedRecord;

      tx.update(ref, {
        [deliveryKey]: delivery,
        auditLog: recordWithAudit.auditLog as BookingAuditEvent[],
        updatedAt: FieldValue.serverTimestamp(),
      });
      return recordWithAudit;
    });
  }

  async proposeAlternative(id: string, options: ProposeAlternativeOptions): Promise<BookingRepositoryResult> {
    const db = getFirestore();
    const ref = db.collection("meetings").doc(id);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND, success: false } as const;
      }
      const current = this.fromMeetingDoc(snap.data() as MeetingStoredDoc);
      const result = proposeAlternativeBooking(current, options);
      if (!result.success) return result;

      tx.update(ref, {
        ...this.toUpdateFields(result.record),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return result;
    });
  }

  private toCreateDoc(record: BookingRecord): Record<string, unknown> {
    return {
      auditLog: record.auditLog as unknown as BookingAuditEvent[],
      calendarDelivery: record.calendarDelivery,
      calendarEventId: record.calendarEventId,
      emailDelivery: record.emailDelivery,
      emailNormalized: normalizeEmail(record.identity.email),
      expiresAt: toFirestoreTimestamp(record.expiresAt),
      googleMeetUrl: record.googleMeetUrl,
      id: record.id,
      identity: record.identity,
      idempotencyKey: record.idempotencyKey,
      locale: record.locale,
      meeting: record.meeting,
      origin: record.origin,
      ownerNotificationRecovery: record.ownerNotificationRecovery,
      payloadHash: record.payloadHash,
      proposalVersion: record.proposalVersion,
      proposedSlot: record.proposedSlot,
      previousRequest: record.previousRequest,
      reason: record.reason,
      relatedService: record.relatedService,
      status: record.status,
      visitorTimezone: record.visitorTimezone,
    };
  }

  private toUpdateFields(record: BookingRecord): Record<string, unknown> {
    return {
      auditLog: record.auditLog as unknown as BookingAuditEvent[],
      calendarDelivery: record.calendarDelivery,
      calendarEventId: record.calendarEventId,
      emailDelivery: record.emailDelivery,
      expiresAt: toFirestoreTimestamp(record.expiresAt),
      googleMeetUrl: record.googleMeetUrl,
      identity: record.identity,
      locale: record.locale,
      meeting: record.meeting,
      payloadHash: record.payloadHash,
      proposalVersion: record.proposalVersion,
      proposedSlot: record.proposedSlot,
      previousRequest: record.previousRequest,
      reason: record.reason,
      relatedService: record.relatedService,
      status: record.status,
      visitorTimezone: record.visitorTimezone,
    };
  }

  private fromMeetingDoc(data: MeetingStoredDoc): BookingRecord {
    return {
      auditLog: (data.auditLog ?? []) as readonly BookingAuditEvent[],
      calendarDelivery: data.calendarDelivery,
      calendarEventId: data.calendarEventId,
      createdAt: timestampToISO(data.createdAt),
      emailDelivery: data.emailDelivery,
      expiresAt: data.expiresAt ? timestampToISO(data.expiresAt) : null,
      googleMeetUrl: data.googleMeetUrl,
      id: data.id,
      identity: data.identity,
      idempotencyKey: data.idempotencyKey,
      locale: data.locale,
      meeting: data.meeting,
      origin: data.origin,
      ownerNotificationRecovery: data.ownerNotificationRecovery ?? null,
      payloadHash: data.payloadHash,
      proposalVersion: data.proposalVersion,
      proposedSlot: data.proposedSlot,
      previousRequest: data.previousRequest,
      reason: data.reason,
      relatedService: data.relatedService,
      status: data.status,
      updatedAt: timestampToISO(data.updatedAt),
      visitorTimezone: data.visitorTimezone,
    };
  }

  private computeSlotEndISO(slotIdentityISO: string): string {
    const startDate = new Date(slotIdentityISO);
    if (Number.isNaN(startDate.getTime())) return slotIdentityISO;
    return addMeetingDuration(startDate).toISOString();
  }
}

function timestampToISO(value: Timestamp | string | null | undefined): BookingTimestamp {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  try {
    return value.toDate().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function matchesCalendarWebhookNotificationClaim(
  state: CalendarWebhookNotificationStoredDoc,
  claim: CalendarWebhookNotificationClaim,
): boolean {
  return state.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING
    && state.processingOwnerNonce === claim.processingOwnerNonce
    && state.processingStartedAt !== null
    && state.processingStartedAt !== undefined
    && timestampToISO(state.processingStartedAt) === claim.processingStartedAt;
}

function hasCalendarWebhookNotificationOwner(
  state: CalendarWebhookNotificationStoredDoc,
  claim: CalendarWebhookNotificationClaim,
): boolean {
  return state.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING
    && state.processingOwnerNonce === claim.processingOwnerNonce;
}

function isCalendarWebhookNotificationLeaseStale(
  processingStartedAt: Timestamp | string | null | undefined,
  now: string,
): boolean {
  if (!processingStartedAt) return true;
  const startedAtMs = new Date(timestampToISO(processingStartedAt)).getTime();
  const nowMs = new Date(now).getTime();
  return Number.isNaN(startedAtMs) || Number.isNaN(nowMs) || nowMs - startedAtMs >= CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS;
}

function idempotencyDocumentId(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
}

/**
 * Convert ISO strings to Firestore `Timestamp` for indexed fields (PRD §6.4).
 * Null and already-Timestamp values are preserved. Invalid strings fall back
 * to the current instant so the doc is always queryable.
 */
function toFirestoreTimestamp(value: string | Timestamp | null): Timestamp | null {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Timestamp.fromDate(new Date());
  return Timestamp.fromDate(parsed);
}
