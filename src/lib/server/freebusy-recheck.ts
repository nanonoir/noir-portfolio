import "server-only";

import { queryPrimaryCalendarFreeBusy, isFreeBusyConfigured, type BusyInterval } from "./google-calendar-freebusy";
import { isFirebaseConfigured } from "./env";
import { withBoundedTimeout } from "./bounded-timeout";
import { FIRESTORE_RATE_LIMIT_TIMEOUT_MS } from "@/lib/meet/deadlines";

/** Checks primary-calendar and reservation conflicts before confirmation. */

const MEETING_DURATION_MS = 30 * 60 * 1000;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface AuthoritativeRecheckInput {
  startISO: string;
  meetingId: string;
}

export interface AuthoritativeRecheckResult {
  available: boolean;
  reason: "ok" | "freebusy_busy" | "reserved_slot_taken" | "freebusy_unavailable";
}

export async function authoritativeFreeBusyRecheck(
  input: AuthoritativeRecheckInput,
): Promise<AuthoritativeRecheckResult> {
  const startDate = new Date(input.startISO);
  if (Number.isNaN(startDate.getTime())) {
    return { available: false, reason: "freebusy_busy" };
  }
  const endDate = new Date(startDate.getTime() + MEETING_DURATION_MS);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (isFreeBusyConfigured()) {
    let busy: BusyInterval[] = [];
    try {
      busy = await queryPrimaryCalendarFreeBusy(startDate.toISOString(), endDate.toISOString());
    } catch {
      // Unknown primary-calendar state must fail closed.
      return { available: false, reason: "freebusy_unavailable" };
    }
    for (const interval of busy) {
      const bStart = new Date(interval.startISO).getTime();
      const bEnd = new Date(interval.endISO).getTime();
      if (overlaps(startMs, endMs, bStart, bEnd)) {
        return { available: false, reason: "freebusy_busy" };
      }
    }
  }

  if (isFirebaseConfigured()) {
    const reservation = await isSlotReservedToAnotherMeeting(input.startISO, input.meetingId);
    if (reservation === "unavailable") {
      return { available: false, reason: "freebusy_unavailable" };
    }
    if (reservation) {
      return { available: false, reason: "reserved_slot_taken" };
    }
  }

  return { available: true, reason: "ok" };
}

async function isSlotReservedToAnotherMeeting(
  slotStartISO: string,
  meetingId: string,
): Promise<boolean | "unavailable"> {
  const { getFirestore } = await import("./firestore");
  try {
    const db = getFirestore();
    const snap = await withBoundedTimeout(
      () => db.collection("reservedSlots").doc(slotStartISO).get(),
      FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
    );
    if (!snap.exists) return false;
    const ownerMeetingId = (snap.data() as { meetingId?: string }).meetingId;
    return Boolean(ownerMeetingId && ownerMeetingId !== meetingId);
  } catch {
    // Unknown reservation ownership must fail closed.
    return "unavailable";
  }
}
