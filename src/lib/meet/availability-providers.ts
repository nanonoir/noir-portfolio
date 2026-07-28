import "server-only";

import type { AvailabilityQuery, AvailabilityRepository } from "./availability-repository";
import type { Slot } from "./domain";
import { isDateWithinBusinessRules, getValidStartTimes } from "./availability-rules";
import { getFirestore } from "@/lib/server/firestore";
import {
  queryPrimaryCalendarFreeBusy,
  type BusyInterval,
} from "@/lib/server/google-calendar-freebusy";
import { isFirebaseConfigured } from "@/lib/server/env";
import { withBoundedTimeout } from "@/lib/server/bounded-timeout";
import { FIRESTORE_RATE_LIMIT_TIMEOUT_MS } from "./deadlines";

/**
 * Phase 3 availability providers implementing the existing
 * `AvailabilityRepository` port.
 *
 * Composition (kept inside the module so callers can opt in):
 *  - Google refresh token present → `GoogleCalendarAvailabilityProvider`
 *    (verified): runs FreeBusy and excludes slot windows that overlap a busy
 *    interval on the primary calendar. Also excludes slots reserved in
 *    Firestore `reservedSlots` (PRD §4.1 internal booking conflicts).
 *  - Production-ish env (Firebase configured) but no refresh token →
 *    `UnverifiedAvailabilityProvider`: returns all business-rule-valid slots
 *    with `availabilityStatus: "unverified"`, no Calendar check, no
 *    reservation, no event creation (PRD §4.3 safe degraded behavior).
 *  - No env → existing `MockAvailabilityRepository` stays the dev fallback.
 */

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Google Calendar FreeBusy-backed provider. Emits only the slots that:
 *  - satisfy PRD §4.1 business rules (weekdays, horizon, lead time);
 *  - exist exactly once in the visitor timezone (no DST gap/duplicate);
 *  - do not overlap any busy interval from the primary calendar;
 *  - are not already reserved by an existing booking in Firestore
 *    `reservedSlots` (internal booking conflicts per PRD §4.1).
 *
 * `GOOGLE_REFRESH_TOKEN` and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` MUST be
 * configured; otherwise the provider throws `FreeBusyError` and the caller
 * surfaces `503 AVAILABILITY_UNAVAILABLE` per PRD §4.3.
 */
export class GoogleCalendarAvailabilityProvider implements AvailabilityRepository {
  isAvailableDate({ date, timezone }: AvailabilityQuery): boolean {
    return isDateWithinBusinessRules(date, timezone);
  }

  async getSlots({ date, timezone }: AvailabilityQuery): Promise<Slot[]> {
    if (!(await this.isAvailableDate({ date, timezone }))) return [];

    const candidates = getValidStartTimes(date, timezone, new Date());
    if (candidates.length === 0) return [];

    const windowStart = candidates[0]!.startISO;
    const windowEnd = candidates[candidates.length - 1]!.endISO;

    const calendarBusy = await queryPrimaryCalendarFreeBusy(windowStart, windowEnd);
    const reservedBusy = await readReservedSlotsInWindow(windowStart, windowEnd);
    const busy = [...calendarBusy, ...reservedBusy];

    return candidates
      .filter((candidate) => {
        const start = new Date(candidate.startISO).getTime();
        const end = new Date(candidate.endISO).getTime();
        return !busy.some((interval) => {
          const bStart = new Date(interval.startISO).getTime();
          const bEnd = new Date(interval.endISO).getTime();
          return overlaps(start, end, bStart, bEnd);
        });
      })
      .map<Slot>((candidate) => ({
        time: candidate.time,
        available: true,
        startISO: candidate.startISO,
        endISO: candidate.endISO,
        availabilityStatus: "verified",
      }));
  }
}

/**
 * Safe degraded provider used when real availability cannot be checked because
 * `GOOGLE_REFRESH_TOKEN` is absent. Returns every business-rule-valid slot
 * with `availabilityStatus: "unverified"`. Per PRD §4.3, this creates a
 * request only; it does NOT reserve a slot or create an event. Nahuel's
 * confirmation performs the authoritative check.
 */
export class UnverifiedAvailabilityProvider implements AvailabilityRepository {
  isAvailableDate({ date, timezone }: AvailabilityQuery): boolean {
    return isDateWithinBusinessRules(date, timezone);
  }

  async getSlots({ date, timezone }: AvailabilityQuery): Promise<Slot[]> {
    if (!(await this.isAvailableDate({ date, timezone }))) return [];

    return getValidStartTimes(date, timezone, new Date()).map<Slot>((candidate) => ({
      time: candidate.time,
      available: true,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
      availabilityStatus: "unverified",
    }));
  }
}

/**
 * Reads existing Firestore `reservedSlots` whose startISO falls inside the
 * query window. Used by the Google provider to exclude internal booking
 * conflicts (PRD §4.1). When Firestore is not configured, returns an empty
 * array so the FreeBusy check still runs cleanly.
 */
async function readReservedSlotsInWindow(windowStartISO: string, windowEndISO: string): Promise<BusyInterval[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getFirestore();
    const snapshot = await withBoundedTimeout(
      () => db
        .collection("reservedSlots")
        .where("startISO", ">=", windowStartISO)
        .where("startISO", "<=", windowEndISO)
        .get(),
      FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
    );

    const intervals: BusyInterval[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as { startISO?: string; endISO?: string };
      if (!data.startISO || !data.endISO) continue;
      intervals.push({ startISO: data.startISO, endISO: data.endISO });
    }
    return intervals;
  } catch {
    // Reservation read failures MUST NOT mask availability; FreeBusy remains
    // the authoritative external check. Phase 4 may retry persistently.
    return [];
  }
}
