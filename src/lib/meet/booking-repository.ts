import "server-only";

import {
  appendProviderAuditEvent,
  proposeAlternativeBooking,
  transitionBooking,
  type BookingTransitionOptions,
  type BookingTransitionResult,
  type ProposeAlternativeOptions,
} from "./booking-lifecycle";
import { BOOKING_AUDIT_ACTIONS } from "./audit-events";
import type { BookingRecord } from "./booking-model";
import { MEETING_ERROR_CODES } from "./codes";
import type { ProviderDeliveryState } from "./dto";
import type { MeetingStatus, SlotIdentity } from "./domain";

export const BOOKING_REPOSITORY_ERROR_CODES = {
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
} as const;

export type BookingRepositoryResult =
  | BookingTransitionResult
  | { error: (typeof BOOKING_REPOSITORY_ERROR_CODES)[keyof typeof BOOKING_REPOSITORY_ERROR_CODES]; success: false };

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

export interface BookingRepository {
  create(record: BookingRecord): Promise<BookingRecord>;
  findById(id: string): Promise<BookingRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<BookingRecord | null>;
  proposeAlternative(id: string, options: ProposeAlternativeOptions): Promise<BookingRepositoryResult>;
  recordIdempotencyReplay(id: string): Promise<BookingRecord | null>;
  /** Future durable adapters MUST atomically reserve slotIdentity and persist record, keyed by idempotencyKey. */
  reserveSlotIfAvailable(input: SlotReservationInput): Promise<SlotReservationResult>;
  updateProviderDetails(id: string, details: Pick<BookingRecord, "calendarEventId" | "googleMeetUrl">): Promise<BookingRecord | null>;
  updateProviderDelivery(id: string, provider: ProviderName, update: ProviderDeliveryUpdate): Promise<BookingRecord | null>;
  updateStatus(id: string, status: MeetingStatus, options?: BookingTransitionOptions): Promise<BookingRepositoryResult>;
}

export class MockBookingRepository implements BookingRepository {
  private readonly bookingsById = new Map<string, BookingRecord>();
  private readonly bookingIdsByIdempotencyKey = new Map<string, string>();
  private readonly bookingIdsBySlotIdentity = new Map<SlotIdentity, string>();

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
}
