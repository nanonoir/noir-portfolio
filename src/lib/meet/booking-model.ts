import "server-only";

import type { BookingRequestDto } from "./dto";
import type { ContactReason, Locale, MeetingOrigin, MeetingStatus, Timezone } from "./domain";
import type { BookingAuditEvent } from "./audit-events";

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
  calendarEventId: string | null;
  createdAt: BookingTimestamp;
  expiresAt: BookingTimestamp | null;
  googleMeetUrl: string | null;
  id: string;
  identity: BookingIdentity;
  idempotencyKey: string;
  locale: Locale;
  meeting: BookingMeeting;
  origin: MeetingOrigin;
  proposalVersion: string;
  proposedSlot: BookingProposedSlot | null;
  reason: ContactReason | null;
  status: MeetingStatus;
  visitorTimezone: Timezone;
  updatedAt: BookingTimestamp;
}

export interface CreateBookingRecordOptions {
  createdAt?: BookingTimestamp;
  id: string;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - date.getTime();
}

function getZonedDateTime({ date, time, visitorTimezone }: BookingProposedSlotInput) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), visitorTimezone));

  return new Date(localAsUtc - getTimeZoneOffsetMs(firstGuess, visitorTimezone));
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

  return {
    auditLog: [],
    calendarEventId: null,
    createdAt,
    expiresAt: null,
    googleMeetUrl: null,
    id: options.id,
    identity: request.identity,
    idempotencyKey: request.idempotencyKey,
    locale: request.locale as Locale,
    meeting: { date: request.meeting.date, time: request.meeting.time },
    origin: request.origin,
    proposalVersion: request.proposalMetadata.proposalVersion,
    proposedSlot: null,
    reason,
    status: "requested",
    visitorTimezone: request.meeting.timezone as Timezone,
    updatedAt: createdAt,
  };
}
