import "server-only";

import { queryPrimaryCalendarFreeBusy, isFreeBusyConfigured, type BusyInterval } from "./google-calendar-freebusy";
import { isFirebaseConfigured } from "./env";
import { withBoundedTimeout } from "./bounded-timeout";
import { FIRESTORE_RATE_LIMIT_TIMEOUT_MS } from "@/lib/meet/deadlines";

/**
 * Phase 5 authoritative FreeBusy recheck (PRD §8.3 step 1 "re-check
 * availability").
 *
 * Used by `ActionService.executeConfirm` / `executeAcceptProposal` immediately
 * before the atomic reservation transaction. Reads ONLY the requested UTC
 * window from the primary calendar so we do not depend on the existing day
 * `getSlots` composition (which is correct but heavier).
 *
 *  - Returns `available: true` when no busy interval on the primary calendar
 *    overlaps the slot window AND the slot is not already reserved to a
 *    *different* meeting in Firestore `reservedSlots`.
 *  - When `GOOGLE_REFRESH_TOKEN` is absent, FreeBusy is unavailable; the slot
 *    is accepted without the Google check (PRD §4.3 unverified degraded
 *    behavior). Firestore `reservedSlots` conflicts are still excluded when
 *    Firebase env is present.
 *
 * Server-only: this module is called only from server-side action handlers.
 */

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

  // 1. FreeBusy against the primary calendar (only when configured).
  if (isFreeBusyConfigured()) {
    let busy: BusyInterval[] = [];
    try {
      busy = await queryPrimaryCalendarFreeBusy(startDate.toISOString(), endDate.toISOString());
    } catch {
      // Configured FreeBusy failing is NOT the same as the documented
      // "refresh token absent" unverified mode. Confirmation must fail closed
      // so we never create an event on a slot whose primary-calendar state is
      // unknown. The action service maps this reason to a stable recoverable
      // `BOOKING_TEMPORARILY_UNAVAILABLE` response.
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

  // 2. Firestore `reservedSlots` conflict (only when Firebase configured).
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
  // Local import keeps the module load order clean: `firestore.ts` lazily
  // initializes on first call so the helper can be unit-imported in tests.
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
    // A reservation read timeout/error leaves the slot ownership unknown.
    // Confirmation must fail closed through its existing recoverable-unavailable
    // contract instead of letting a Vercel request hang or accepting the slot.
    return "unavailable";
  }
}
