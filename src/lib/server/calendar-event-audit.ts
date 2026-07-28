import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { getFirestore } from "./firestore";
import { isFirebaseConfigured } from "./env";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

/**
 * Phase 5 calendar-event audit trail (PRD §6.1 "events" subcollection,
 * §13.5 "persist under meetings/events").
 *
 * Each provider attempt (create / update / cancel) appends one immutable
 * record to `meetings/{meetingId}/events/{eventId}`. The record captures the
 * action, the canonical calendarEventId, the provider delivery state at the
 * time of the attempt, and the raw outbound response status — never the
 * visitor's lead content, message body, or any credential.
 *
 * Server-only: writes happen exclusively through Firebase Admin SDK. The
 * subcollection is for auditability; canonical Calendar link live on the
 * parent `BookingRecord.calendarEventId` / `googleMeetUrl` fields.
 */

export type CalendarEventAuditAction = "create" | "update" | "cancel";

export interface CalendarEventAuditRecord {
  id: string;
  meetingId: string;
  action: CalendarEventAuditAction;
  provider: "google" | "mock";
  calendarEventId: string;
  googleMeetUrl: string;
  status: "completed" | "failed";
  errorCode?: string;
  attemptNumber: number;
  createdAt: string;
}

type StoredAuditDoc = Omit<CalendarEventAuditRecord, "createdAt"> & {
  createdAt: Timestamp | string;
};

function timestampToISO(value: Timestamp | string): string {
  if (typeof value === "string") return value;
  try {
    return value.toDate().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Persist one audit row for a Calendar provider attempt. Failures are logged
 * via `meetLogger` but never throw — the parent `BookingRecord` auditLog is
 * the source of truth and a missing event-audit row MUST NOT roll back the
 * booking transition.
 */
export async function recordCalendarEventAudit(
  record: Omit<CalendarEventAuditRecord, "createdAt">,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  try {
    const db = getFirestore();
    const ref = db
      .collection("meetings")
      .doc(record.meetingId)
      .collection("events")
      .doc(record.id);
    await ref.set({
      id: record.id,
      meetingId: record.meetingId,
      action: record.action,
      provider: record.provider,
      calendarEventId: record.calendarEventId,
      googleMeetUrl: record.googleMeetUrl,
      status: record.status,
      ...(record.errorCode ? { errorCode: record.errorCode } : {}),
      attemptNumber: record.attemptNumber,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    meetLogger.error("calendar.event_audit.persist_failed", {
      bookingId: record.meetingId,
      cause: normalizeErrorCause(error),
    });
  }
}

/**
 * Read-back helper for verify / debug. Returns audit records for the meeting
 * ordered by `attemptNumber` ascending. Pure read path; never throws — returns
 * an empty array if Firestore access or the meeting is unreachable.
 */
export async function listCalendarEventAudit(
  meetingId: string,
): Promise<CalendarEventAuditRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const db = getFirestore();
    const snap = await db
      .collection("meetings")
      .doc(meetingId)
      .collection("events")
      .orderBy("attemptNumber", "asc")
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data() as StoredAuditDoc;
      return {
        id: data.id,
        meetingId: data.meetingId,
        action: data.action,
        provider: data.provider,
        calendarEventId: data.calendarEventId,
        googleMeetUrl: data.googleMeetUrl,
        status: data.status,
        ...(data.errorCode ? { errorCode: data.errorCode } : {}),
        attemptNumber: data.attemptNumber,
        createdAt: timestampToISO(data.createdAt),
      } satisfies CalendarEventAuditRecord;
    });
  } catch (error) {
    meetLogger.error("calendar.event_audit.read_failed", {
      bookingId: meetingId,
      cause: normalizeErrorCause(error),
    });
    return [];
  }
}