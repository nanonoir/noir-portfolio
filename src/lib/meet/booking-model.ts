import "server-only";

import {
  PROVIDER_DELIVERY_STATUSES,
  type BookingPayloadHash,
  type BookingRequestDto,
  type ProviderDeliveryState,
} from "./dto";
import type { ContactReason, Locale, MeetingOrigin, MeetingStatus, Timezone } from "./domain";
import type { BookingAuditEvent } from "./audit-events";
import { createSafeHash } from "./serialization";
import { getZonedDateTime as getSharedZonedDateTime } from "./zoned-date-time";

export type BookingTimestamp = string;

export interface BookingIdentity {
  email: string;
  message?: string;
  name: string;
  phone: string;
}

export interface BookingMeeting {
  date: string;
  time: string;
}

export interface BookingPreviousRequest {
  details: Record<string, unknown>;
  service: string;
}

export interface BookingProposedSlotInput {
  date: string;
  time: string;
  visitorTimezone: Timezone;
}

export interface BookingProposedSlot extends BookingProposedSlotInput {
  startsAt: BookingTimestamp;
}

export interface BookingRecord {
  auditLog: readonly BookingAuditEvent[];
  calendarDelivery: ProviderDeliveryState;
  calendarEventId: string | null;
  createdAt: BookingTimestamp;
  expiresAt: BookingTimestamp | null;
  emailDelivery: ProviderDeliveryState;
  googleMeetUrl: string | null;
  id: string;
  identity: BookingIdentity;
  idempotencyKey: string;
  locale: Locale;
  meeting: BookingMeeting;
  origin: MeetingOrigin;
  payloadHash: BookingPayloadHash;
  proposalVersion: string;
  proposedSlot: BookingProposedSlot | null;
  previousRequest: BookingPreviousRequest | null;
  reason: ContactReason | null;
  relatedService: string | null;
  status: MeetingStatus;
  visitorTimezone: Timezone;
  updatedAt: BookingTimestamp;
}

export interface CreateBookingRecordOptions {
  calendarDelivery?: ProviderDeliveryState;
  createdAt?: BookingTimestamp;
  emailDelivery?: ProviderDeliveryState;
  id: string;
  payloadHash?: BookingPayloadHash;
}

export function createBookingPayloadHash(request: BookingRequestDto): BookingPayloadHash {
  const semanticPayload = {
    identity: request.identity,
    locale: request.locale,
    meeting: request.meeting,
    origin: request.origin,
    proposalMetadata: {
      originVersion: request.proposalMetadata.originVersion,
      proposalVersion: request.proposalMetadata.proposalVersion,
    },
    ...(request.origin === "contact"
      ? { reason: request.reason }
      : { previousRequest: request.previousRequest, relatedService: request.relatedService }),
  };
  const hash = createSafeHash(semanticPayload, "booking_");

  return (hash.safe ? hash.value : "booking_unsafe") as BookingPayloadHash;
}

function getZonedDateTime({ date, time, visitorTimezone }: BookingProposedSlotInput) {
  return getSharedZonedDateTime({ date, time, timezone: visitorTimezone });
}

export function createProposedSlot(input: BookingProposedSlotInput): BookingProposedSlot {
  return {
    ...input,
    startsAt: getZonedDateTime(input).toISOString(),
  };
}

export function getProposalExpiration(proposedSlot: BookingProposedSlot): BookingTimestamp {
  return proposedSlot.startsAt;
}

export function createBookingRecord(request: BookingRequestDto, options: CreateBookingRecordOptions): BookingRecord {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const reason = request.origin === "contact" ? request.reason : null;
  const previousRequest = request.origin === "contact" ? null : request.previousRequest;
  const relatedService = request.origin === "contact" ? null : request.relatedService;
  const pendingDelivery: ProviderDeliveryState = { attempts: 0, status: PROVIDER_DELIVERY_STATUSES.PENDING };

  return {
    auditLog: [],
    calendarDelivery: options.calendarDelivery ?? pendingDelivery,
    calendarEventId: null,
    createdAt,
    expiresAt: null,
    emailDelivery: options.emailDelivery ?? pendingDelivery,
    googleMeetUrl: null,
    id: options.id,
    identity: request.identity,
    idempotencyKey: request.idempotencyKey,
    locale: request.locale as Locale,
    meeting: { date: request.meeting.date, time: request.meeting.time },
    origin: request.origin,
    payloadHash: options.payloadHash ?? createBookingPayloadHash(request),
    proposalVersion: request.proposalMetadata.proposalVersion,
    proposedSlot: null,
    previousRequest,
    reason,
    relatedService,
    status: "requested",
    visitorTimezone: request.meeting.timezone as Timezone,
    updatedAt: createdAt,
  };
}
