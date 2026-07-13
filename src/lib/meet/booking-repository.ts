import "server-only";

import {
  proposeAlternativeBooking,
  transitionBooking,
  type BookingTransitionOptions,
  type BookingTransitionResult,
  type ProposeAlternativeOptions,
} from "./booking-lifecycle";
import type { BookingRecord } from "./booking-model";
import { MEETING_ERROR_CODES } from "./codes";
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

export type SlotReservationResult =
  | { record: BookingRecord; success: true }
  | { error: typeof MEETING_ERROR_CODES.SLOT_UNAVAILABLE; success: false };

export interface BookingRepository {
  create(record: BookingRecord): Promise<BookingRecord>;
  findById(id: string): Promise<BookingRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<BookingRecord | null>;
  proposeAlternative(id: string, options: ProposeAlternativeOptions): Promise<BookingRepositoryResult>;
  /** Future durable adapters MUST atomically reserve slotIdentity and persist record, keyed by idempotencyKey. */
  reserveSlotIfAvailable(input: SlotReservationInput): Promise<SlotReservationResult>;
  updateProviderDetails(id: string, details: Pick<BookingRecord, "calendarEventId" | "googleMeetUrl">): Promise<BookingRecord | null>;
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
      return { record: existing, success: true };
    }

    if (this.bookingIdsBySlotIdentity.has(slotIdentity)) {
      return { error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false };
    }

    this.bookingIdsBySlotIdentity.set(slotIdentity, record.id);
    await this.create(record);

    return { record, success: true };
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

    const updatedRecord = { ...record, ...details, updatedAt: new Date().toISOString() };
    this.bookingsById.set(id, updatedRecord);

    return updatedRecord;
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
