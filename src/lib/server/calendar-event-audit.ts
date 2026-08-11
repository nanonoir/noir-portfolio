import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { getFirestore } from "./firestore";
import { isFirebaseConfigured } from "./env";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

/** Immutable provider attempts omit visitor content and credentials. */

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

/** Audit persistence never throws or rolls back the booking transition. */
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

/** Reads ordered audit records and returns an empty array on access failure. */
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
