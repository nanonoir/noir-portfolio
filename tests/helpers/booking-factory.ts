import {
  createBookingRecord,
  type BookingRecord,
} from "@/lib/meet/booking-model";
import type { BookingRequestDto } from "@/lib/meet/dto";
import type { Slot } from "@/lib/meet/domain";
import { ACTION_TOKEN_ACTORS, type ActionTokenRecord } from "@/lib/meet/action-tokens";
import { ACTION_TOKEN_ACTIONS } from "@/lib/meet/action-contract";

const DEFAULT_TIMESTAMP = "2026-08-03T12:00:00.000Z";

export interface BookingRequestFactoryOptions {
  idempotencyKey?: string;
  meetingDate?: string;
  meetingTime?: string;
  visitorEmail?: string;
}

export interface BookingRecordFactoryOptions extends BookingRequestFactoryOptions {
  id?: string;
}

export function createBookingRequest(
  options: BookingRequestFactoryOptions = {},
): BookingRequestDto {
  return {
    type: "meeting_request",
    identity: {
      email: options.visitorEmail ?? "visitor@example.com",
      name: "Test Visitor",
      phone: "+15555550100",
    },
    idempotencyKey: options.idempotencyKey ?? "00000000-0000-4000-8000-000000000001",
    locale: "en",
    meeting: {
      date: options.meetingDate ?? "2026-08-04",
      time: options.meetingTime ?? "10:00",
      timezone: "UTC",
    },
    origin: "contact",
    proposalMetadata: {
      originVersion: "test-v1",
      proposalVersion: "1",
      submittedAt: DEFAULT_TIMESTAMP,
    },
    reason: "project",
  };
}

export function createBookingRecordFixture(
  options: BookingRecordFactoryOptions = {},
): BookingRecord {
  return createBookingRecord(createBookingRequest(options), {
    createdAt: DEFAULT_TIMESTAMP,
    id: options.id ?? "test-booking-001",
  });
}

export function createActionTokenRecord(
  overrides: Partial<ActionTokenRecord> = {},
): ActionTokenRecord {
  return {
    action: ACTION_TOKEN_ACTIONS.CONFIRM,
    actor: ACTION_TOKEN_ACTORS.OWNER,
    createdAt: DEFAULT_TIMESTAMP,
    expiresAt: "2026-08-10T12:00:00.000Z",
    id: "test-token-001",
    meetingId: "test-booking-001",
    proposalVersion: "1",
    processingOwnerNonce: null,
    processingStartedAt: null,
    result: null,
    tokenHash: "test-token-hash",
    usedAt: null,
    ...overrides,
  };
}

export const SAMPLE_SLOTS: readonly Slot[] = [
  { available: true, time: "10:00" },
  { available: true, time: "11:00" },
];
