import "server-only";

import type { BookingRecord, BookingTimestamp } from "./booking-model";
import type { MeetingStatus } from "./domain";

export const BOOKING_AUDIT_ACTORS = {
  SYSTEM: "system",
  TEAM: "team",
  VISITOR: "visitor",
} as const;

export type BookingAuditActor = (typeof BOOKING_AUDIT_ACTORS)[keyof typeof BOOKING_AUDIT_ACTORS];

export const BOOKING_AUDIT_ACTIONS = {
  ALTERNATIVE_PROPOSED: "alternative_proposed",
  STATUS_CHANGED: "status_changed",
} as const;

export type BookingAuditAction = (typeof BOOKING_AUDIT_ACTIONS)[keyof typeof BOOKING_AUDIT_ACTIONS];

export interface BookingAuditEvent {
  action: BookingAuditAction;
  actor: BookingAuditActor;
  fromStatus: MeetingStatus;
  id: string;
  payload: Readonly<Record<string, unknown>>;
  timestamp: BookingTimestamp;
  toStatus: MeetingStatus;
}

export interface AppendAuditEventInput {
  action: BookingAuditAction;
  actor: BookingAuditActor;
  fromStatus: MeetingStatus;
  id: string;
  payload?: Record<string, unknown>;
  timestamp: BookingTimestamp;
  toStatus: MeetingStatus;
}

export function appendAuditEvent(record: BookingRecord, input: AppendAuditEventInput): BookingRecord {
  const event: BookingAuditEvent = {
    ...input,
    payload: Object.freeze({ ...input.payload }),
  };
  const auditLog = [...record.auditLog, event].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return { ...record, auditLog };
}
