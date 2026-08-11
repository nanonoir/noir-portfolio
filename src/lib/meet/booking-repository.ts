import "server-only";

import {
  appendProviderAuditEvent,
  proposeAlternativeBooking,
  transitionBooking,
  transitionBookingWithAcceptedProposal,
  type BookingTransitionOptions,
  type BookingTransitionResult,
  type ProposeAlternativeOptions,
} from "./booking-lifecycle";
import { BOOKING_AUDIT_ACTIONS } from "./audit-events";
import type { BookingRecord } from "./booking-model";
import { MEETING_ERROR_CODES } from "./codes";
import type { ProviderDeliveryState } from "./dto";
import type { MeetingStatus, SlotIdentity } from "./domain";
import { CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS } from "./deadlines";

export { CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS } from "./deadlines";

export const BOOKING_REPOSITORY_ERROR_CODES = {
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
} as const;

export type BookingRepositoryResult =
  | BookingTransitionResult
  | {
    error:
      | (typeof BOOKING_REPOSITORY_ERROR_CODES)[keyof typeof BOOKING_REPOSITORY_ERROR_CODES]
      | typeof MEETING_ERROR_CODES.SLOT_UNAVAILABLE;
    success: false;
  };

export interface SlotReservationInput {
  record: BookingRecord;
  slotIdentity: SlotIdentity;
}

export type ProviderName = "calendar" | "email";

export interface ProviderDeliveryUpdate {
  errorCode?: string;
  status: "completed" | "failed";
}

export type SlotReservationResult =
  | { record: BookingRecord; replayed: boolean; success: true }
  | { error: typeof MEETING_ERROR_CODES.SLOT_UNAVAILABLE; success: false };

/** Atomically reserves a slot, releases prior ownership, and transitions status. */
export interface ReserveSlotForMeetingInput {
  meetingId: string;
  slotIdentity: SlotIdentity;
  toStatus: MeetingStatus;
  transitionOptions?: BookingTransitionOptions;
}

export interface CalendarWebhookNotificationClaim {
  processingOwnerNonce: string;
  processingStartedAt: string;
}

const CALENDAR_WEBHOOK_NOTIFICATION_STATUS = {
  COMPLETED: "completed",
  PROCESSING: "processing",
} as const;

type CalendarWebhookNotificationStatus =
  (typeof CALENDAR_WEBHOOK_NOTIFICATION_STATUS)[keyof typeof CALENDAR_WEBHOOK_NOTIFICATION_STATUS];

interface CalendarWebhookNotificationState {
  processingOwnerNonce: string | null;
  processingStartedAt: string | null;
  status: CalendarWebhookNotificationStatus;
}

export interface BookingRepository {
  claimCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean>;
  completeCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean>;
  create(record: BookingRecord): Promise<BookingRecord>;
  findById(id: string): Promise<BookingRecord | null>;
  findByCalendarEventId(calendarEventId: string): Promise<BookingRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<BookingRecord | null>;
  proposeAlternative(id: string, options: ProposeAlternativeOptions): Promise<BookingRepositoryResult>;
  recordIdempotencyReplay(id: string): Promise<BookingRecord | null>;
  /** Future durable adapters MUST atomically reserve slotIdentity and persist record, keyed by idempotencyKey. */
  reserveSlotIfAvailable(input: SlotReservationInput): Promise<SlotReservationResult>;
  /** Reserves a new slot, releases prior ownership, and advances to `toStatus`. */
  reserveSlotForMeeting(input: ReserveSlotForMeetingInput): Promise<BookingRepositoryResult>;
  heartbeatCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean>;
  releaseCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<void>;
  updateOwnerNotificationRecovery(id: string, recovery: string | null): Promise<BookingRecord | null>;
  updateProviderDetails(id: string, details: Pick<BookingRecord, "calendarEventId" | "googleMeetUrl">): Promise<BookingRecord | null>;
  updateProviderDelivery(id: string, provider: ProviderName, update: ProviderDeliveryUpdate): Promise<BookingRecord | null>;
  updateStatus(id: string, status: MeetingStatus, options?: BookingTransitionOptions): Promise<BookingRepositoryResult>;
}

export class MockBookingRepository implements BookingRepository {
  private readonly bookingsById = new Map<string, BookingRecord>();
  private readonly bookingIdsByIdempotencyKey = new Map<string, string>();
  private readonly bookingIdsBySlotIdentity = new Map<SlotIdentity, string>();
  private readonly calendarWebhookNotifications = new Map<string, CalendarWebhookNotificationState>();

  async claimCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const current = this.calendarWebhookNotifications.get(notificationId);
    if (current?.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.COMPLETED) return false;
    if (current?.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING && !isCalendarWebhookNotificationLeaseStale(current.processingStartedAt, claim.processingStartedAt)) return false;
    this.calendarWebhookNotifications.set(notificationId, {
      processingOwnerNonce: claim.processingOwnerNonce,
      processingStartedAt: claim.processingStartedAt,
      status: CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING,
    });
    return true;
  }

  async completeCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const current = this.calendarWebhookNotifications.get(notificationId);
    if (!matchesCalendarWebhookNotificationClaim(current, claim)) return false;
    this.calendarWebhookNotifications.set(notificationId, {
      processingOwnerNonce: null,
      processingStartedAt: null,
      status: CALENDAR_WEBHOOK_NOTIFICATION_STATUS.COMPLETED,
    });
    return true;
  }

  async create(record: BookingRecord): Promise<BookingRecord> {
    const existing = await this.findByIdempotencyKey(record.idempotencyKey);

    if (existing) {
      return existing;
    }

    this.bookingsById.set(record.id, record);
    this.bookingIdsByIdempotencyKey.set(record.idempotencyKey, record.id);

    return record;
  }

  async findById(id: string): Promise<BookingRecord | null> {
    return this.bookingsById.get(id) ?? null;
  }

  async findByCalendarEventId(calendarEventId: string): Promise<BookingRecord | null> {
    return Array.from(this.bookingsById.values()).find(
      (booking) => booking.calendarEventId === calendarEventId,
    ) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<BookingRecord | null> {
    const id = this.bookingIdsByIdempotencyKey.get(idempotencyKey);

    return id ? this.findById(id) : null;
  }

  async reserveSlotIfAvailable({ record, slotIdentity }: SlotReservationInput): Promise<SlotReservationResult> {
    const existing = await this.findByIdempotencyKey(record.idempotencyKey);

    if (existing) {
      return { record: existing, replayed: true, success: true };
    }

    if (this.bookingIdsBySlotIdentity.has(slotIdentity)) {
      return { error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false };
    }

    this.bookingsById.set(record.id, record);
    this.bookingIdsByIdempotencyKey.set(record.idempotencyKey, record.id);
    this.bookingIdsBySlotIdentity.set(slotIdentity, record.id);

    return { record, replayed: false, success: true };
  }

  async recordIdempotencyReplay(id: string): Promise<BookingRecord | null> {
    const record = await this.findById(id);

    if (!record) return null;

    const updatedAt = new Date().toISOString();
    const updatedRecord = appendProviderAuditEvent(
      { ...record, updatedAt },
      BOOKING_AUDIT_ACTIONS.IDEMPOTENCY_REPLAY,
      { now: updatedAt, payload: { idempotencyKey: record.idempotencyKey } },
    );
    this.bookingsById.set(id, updatedRecord);

    return updatedRecord;
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    options: BookingTransitionOptions = {},
  ): Promise<BookingRepositoryResult> {
    const record = await this.findById(id);

    if (!record) {
      return { error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND, success: false };
    }

    const result = transitionBooking(record, status, options);

    if (result.success) {
      this.bookingsById.set(id, result.record);
      // Terminal transitions release the concrete slot reservation.
      if (status === "cancelled" || status === "declined" || status === "expired") {
        const reservedSlot = Array.from(this.bookingIdsBySlotIdentity.entries())
          .find(([, ownerId]) => ownerId === id);
        if (reservedSlot) {
          this.bookingIdsBySlotIdentity.delete(reservedSlot[0]);
        }
      }
    }

    return result;
  }

  async updateProviderDetails(
    id: string,
    details: Pick<BookingRecord, "calendarEventId" | "googleMeetUrl">,
  ): Promise<BookingRecord | null> {
    const record = await this.findById(id);

    if (!record) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    const providerWasRecovered = record.calendarDelivery.status === "failed";
    const updatedRecord = {
      ...record,
      ...details,
      calendarDelivery: {
        ...record.calendarDelivery,
        attempts: record.calendarDelivery.attempts + 1,
        status: "completed" as const,
      },
      updatedAt,
    };
    const recordWithAudit = providerWasRecovered
      ? appendProviderAuditEvent(updatedRecord, BOOKING_AUDIT_ACTIONS.PROVIDER_RECOVERED, {
        now: updatedAt,
        payload: { provider: "calendar" },
      })
      : updatedRecord;
    this.bookingsById.set(id, recordWithAudit);

    return recordWithAudit;
  }

  async updateProviderDelivery(
    id: string,
    provider: ProviderName,
    update: ProviderDeliveryUpdate,
  ): Promise<BookingRecord | null> {
    const record = await this.findById(id);

    if (!record) return null;

    const updatedAt = new Date().toISOString();
    const deliveryKey = provider === "calendar" ? "calendarDelivery" : "emailDelivery";
    const previousDelivery = record[deliveryKey] as ProviderDeliveryState;
    const delivery: ProviderDeliveryState = {
      attempts: previousDelivery.attempts + 1,
      ...(previousDelivery.lastError ? { lastError: previousDelivery.lastError } : {}),
      ...(update.status === "failed" && update.errorCode
        ? { lastError: { code: update.errorCode, occurredAt: updatedAt } }
        : {}),
      status: update.status,
    };
    const updatedRecord = { ...record, [deliveryKey]: delivery, updatedAt } as BookingRecord;
    const action = update.status === "failed"
      ? BOOKING_AUDIT_ACTIONS.PROVIDER_FAILED
      : previousDelivery.status === "failed"
        ? BOOKING_AUDIT_ACTIONS.PROVIDER_RECOVERED
        : null;
    const recordWithAudit = action
      ? appendProviderAuditEvent(updatedRecord, action, {
        now: updatedAt,
        payload: { code: update.errorCode, provider },
      })
      : updatedRecord;
    this.bookingsById.set(id, recordWithAudit);

    return recordWithAudit;
  }

  async proposeAlternative(id: string, options: ProposeAlternativeOptions): Promise<BookingRepositoryResult> {
    const record = await this.findById(id);

    if (!record) {
      return { error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND, success: false };
    }

    const result = proposeAlternativeBooking(record, options);

    if (result.success) {
      this.bookingsById.set(id, result.record);
    }

    return result;
  }

  async reserveSlotForMeeting(input: ReserveSlotForMeetingInput): Promise<BookingRepositoryResult> {
    const record = await this.findById(input.meetingId);
    if (!record) {
      return { error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND, success: false };
    }

    // Replays for the same meeting and slot do not re-transition.
    const existingOwner = this.bookingIdsBySlotIdentity.get(input.slotIdentity);
    if (existingOwner && existingOwner !== input.meetingId) {
      return { error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false };
    }

    // Transition first so refusals occur before reservation mutation.
    const transitionOptions = input.transitionOptions ?? {};
    const transition = transitionBookingWithAcceptedProposal(record, input.toStatus, transitionOptions);
    if (!transition.success) return transition;

    // Release any prior reservation owned by this meeting (reschedule).
    const previousSlotForMeeting = Array.from(this.bookingIdsBySlotIdentity.entries())
      .find(([, ownerId]) => ownerId === input.meetingId);
    if (previousSlotForMeeting && previousSlotForMeeting[0] !== input.slotIdentity) {
      this.bookingIdsBySlotIdentity.delete(previousSlotForMeeting[0]);
    }
    this.bookingIdsBySlotIdentity.set(input.slotIdentity, input.meetingId);
    this.bookingsById.set(input.meetingId, transition.record);

    return transition;
  }

  async updateOwnerNotificationRecovery(id: string, recovery: string | null): Promise<BookingRecord | null> {
    const record = await this.findById(id);
    if (!record) return null;
    const updatedRecord = { ...record, ownerNotificationRecovery: recovery, updatedAt: new Date().toISOString() };
    this.bookingsById.set(id, updatedRecord);
    return updatedRecord;
  }

  async heartbeatCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<boolean> {
    const current = this.calendarWebhookNotifications.get(notificationId);
    if (!current || !hasCalendarWebhookNotificationOwner(current, claim)) return false;
    this.calendarWebhookNotifications.set(notificationId, {
      processingOwnerNonce: current.processingOwnerNonce,
      processingStartedAt: claim.processingStartedAt,
      status: current.status,
    });
    return true;
  }

  async releaseCalendarWebhookNotification(notificationId: string, claim: CalendarWebhookNotificationClaim): Promise<void> {
    const current = this.calendarWebhookNotifications.get(notificationId);
    if (matchesCalendarWebhookNotificationClaim(current, claim)) this.calendarWebhookNotifications.delete(notificationId);
  }
}

function matchesCalendarWebhookNotificationClaim(
  state: CalendarWebhookNotificationState | undefined,
  claim: CalendarWebhookNotificationClaim,
): boolean {
  return state?.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING
    && state.processingOwnerNonce === claim.processingOwnerNonce
    && state.processingStartedAt === claim.processingStartedAt;
}

function hasCalendarWebhookNotificationOwner(
  state: CalendarWebhookNotificationState,
  claim: CalendarWebhookNotificationClaim,
): boolean {
  return state.status === CALENDAR_WEBHOOK_NOTIFICATION_STATUS.PROCESSING
    && state.processingOwnerNonce === claim.processingOwnerNonce;
}

function isCalendarWebhookNotificationLeaseStale(processingStartedAt: string | null, now: string): boolean {
  if (!processingStartedAt) return true;
  const startedAtMs = new Date(processingStartedAt).getTime();
  const nowMs = new Date(now).getTime();
  return Number.isNaN(startedAtMs) || Number.isNaN(nowMs) || nowMs - startedAtMs >= CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS;
}
