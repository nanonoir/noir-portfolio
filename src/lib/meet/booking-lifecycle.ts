import "server-only";

import {
  BOOKING_AUDIT_ACTIONS,
  BOOKING_AUDIT_ACTORS,
  appendAuditEvent,
  type BookingAuditActor,
  type BookingAuditAction,
} from "./audit-events";
import {
  createProposedSlot,
  getProposalExpiration,
  type BookingProposedSlotInput,
  type BookingRecord,
  type BookingTimestamp,
} from "./booking-model";
import { MEETING_STATUSES, type MeetingStatus } from "./domain";

export const BOOKING_LIFECYCLE_ERROR_CODES = {
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  PROPOSAL_EXPIRED: "PROPOSAL_EXPIRED",
} as const;

export type BookingLifecycleErrorCode =
  (typeof BOOKING_LIFECYCLE_ERROR_CODES)[keyof typeof BOOKING_LIFECYCLE_ERROR_CODES];

export const BOOKING_STATUS_TRANSITIONS: Readonly<Record<MeetingStatus, readonly MeetingStatus[]>> = {
  [MEETING_STATUSES.REQUESTED]: [
    MEETING_STATUSES.OWNER_CONFIRMED,
    MEETING_STATUSES.RESCHEDULE_PROPOSED,
    MEETING_STATUSES.DECLINED,
    MEETING_STATUSES.EXPIRED,
    MEETING_STATUSES.CANCELLED,
  ],
  [MEETING_STATUSES.RESCHEDULE_PROPOSED]: [
    MEETING_STATUSES.OWNER_CONFIRMED,
    MEETING_STATUSES.RESCHEDULE_PROPOSED,
    MEETING_STATUSES.DECLINED,
    MEETING_STATUSES.EXPIRED,
    MEETING_STATUSES.CANCELLED,
  ],
  [MEETING_STATUSES.OWNER_CONFIRMED]: [
    MEETING_STATUSES.CONFIRMED,
    MEETING_STATUSES.OWNER_CONFIRMED,
    MEETING_STATUSES.RESCHEDULE_PROPOSED,
    MEETING_STATUSES.DECLINED,
    MEETING_STATUSES.CANCELLED,
  ],
  [MEETING_STATUSES.CONFIRMED]: [MEETING_STATUSES.CANCELLED],
  [MEETING_STATUSES.DECLINED]: [MEETING_STATUSES.REQUESTED, MEETING_STATUSES.CANCELLED],
  [MEETING_STATUSES.EXPIRED]: [MEETING_STATUSES.REQUESTED],
  [MEETING_STATUSES.CANCELLED]: [],
};

export interface BookingTransitionOptions {
  actor?: BookingAuditActor;
  now?: BookingTimestamp;
  payload?: Record<string, unknown>;
}

export interface ProposeAlternativeOptions extends BookingTransitionOptions {
  proposedSlot: BookingProposedSlotInput;
}

export type ProviderAuditAction = Extract<
  BookingAuditAction,
  "provider_failed" | "provider_recovered" | "idempotency_replay"
>;

export interface ProviderAuditOptions {
  actor?: BookingAuditActor;
  now?: BookingTimestamp;
  payload?: Record<string, unknown>;
}

export type BookingTransitionResult =
  | { record: BookingRecord; success: true }
  | { error: BookingLifecycleErrorCode; success: false };

export function canTransitionBooking(fromStatus: MeetingStatus, toStatus: MeetingStatus) {
  return BOOKING_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function appendProviderAuditEvent(
  record: BookingRecord,
  action: ProviderAuditAction,
  options: ProviderAuditOptions = {},
): BookingRecord {
  const now = options.now ?? new Date().toISOString();

  return appendAuditEvent(record, {
    action,
    actor: options.actor ?? BOOKING_AUDIT_ACTORS.SYSTEM,
    fromStatus: record.status,
    id: crypto.randomUUID(),
    payload: options.payload,
    timestamp: now,
    toStatus: record.status,
  });
}

export function transitionBooking(
  record: BookingRecord,
  nextStatus: MeetingStatus,
  options: BookingTransitionOptions = {},
): BookingTransitionResult {
  const now = options.now ?? new Date().toISOString();

  if (!canTransitionBooking(record.status, nextStatus)) {
    return { error: BOOKING_LIFECYCLE_ERROR_CODES.INVALID_STATUS_TRANSITION, success: false };
  }

  // Reservation transitions reject expired proposals; RSVP confirmation does not.
  const isReservationTransition = nextStatus === MEETING_STATUSES.OWNER_CONFIRMED;
  if (
    isReservationTransition &&
    record.expiresAt !== null &&
    record.proposedSlot !== null &&
    new Date(record.expiresAt).getTime() <= new Date(now).getTime()
  ) {
    return { error: BOOKING_LIFECYCLE_ERROR_CODES.PROPOSAL_EXPIRED, success: false };
  }

  const updatedRecord = appendAuditEvent(
    { ...record, status: nextStatus, updatedAt: now },
    {
      action: BOOKING_AUDIT_ACTIONS.STATUS_CHANGED,
      actor: options.actor ?? BOOKING_AUDIT_ACTORS.SYSTEM,
      fromStatus: record.status,
      id: crypto.randomUUID(),
      payload: options.payload,
      timestamp: now,
      toStatus: nextStatus,
    },
  );

  return { record: updatedRecord, success: true };
}

export function transitionBookingWithAcceptedProposal(
  record: BookingRecord,
  nextStatus: MeetingStatus,
  options: BookingTransitionOptions = {},
): BookingTransitionResult {
  const result = transitionBooking(record, nextStatus, options);
  if (!result.success) return result;

  const proposedSlot = record.proposedSlot;
  if (
    record.status === MEETING_STATUSES.RESCHEDULE_PROPOSED &&
    nextStatus === MEETING_STATUSES.OWNER_CONFIRMED &&
    proposedSlot
  ) {
    return {
      success: true,
      record: {
        ...result.record,
        meeting: { date: proposedSlot.date, time: proposedSlot.time },
        visitorTimezone: proposedSlot.visitorTimezone,
        proposedSlot: null,
        expiresAt: null,
      },
    };
  }

  return result;
}

export function proposeAlternativeBooking(
  record: BookingRecord,
  options: ProposeAlternativeOptions,
): BookingTransitionResult {
  const now = options.now ?? new Date().toISOString();

  if (!canTransitionBooking(record.status, MEETING_STATUSES.RESCHEDULE_PROPOSED)) {
    return { error: BOOKING_LIFECYCLE_ERROR_CODES.INVALID_STATUS_TRANSITION, success: false };
  }

  const proposedSlot = createProposedSlot(options.proposedSlot);
  const expiresAt = getProposalExpiration(proposedSlot);
  const proposalVersion = getNextProposalVersion(record.proposalVersion);
  const updatedRecord = appendAuditEvent(
    {
      ...record,
      expiresAt,
      proposalVersion,
      proposedSlot,
      status: MEETING_STATUSES.RESCHEDULE_PROPOSED,
      updatedAt: now,
    },
    {
      action: BOOKING_AUDIT_ACTIONS.ALTERNATIVE_PROPOSED,
      actor: options.actor ?? BOOKING_AUDIT_ACTORS.VISITOR,
      fromStatus: record.status,
      id: crypto.randomUUID(),
      payload: {
        expiresAt,
        proposalVersion,
        proposedSlot,
        ...options.payload,
      },
      timestamp: now,
      toStatus: MEETING_STATUSES.RESCHEDULE_PROPOSED,
    },
  );

  return { record: updatedRecord, success: true };
}

function getNextProposalVersion(currentVersion: string) {
  const versionMatch = currentVersion.match(/^(.*?)(\d+)$/);

  if (!versionMatch) {
    return `${currentVersion}.1`;
  }

  return `${versionMatch[1]}${Number(versionMatch[2]) + 1}`;
}
