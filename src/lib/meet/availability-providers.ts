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


function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Returns business-rule-valid slots excluding external and internal conflicts. */
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

    const [calendarBusy, reservedBusy] = await Promise.all([
      queryPrimaryCalendarFreeBusy(windowStart, windowEnd),
      readReservedSlotsInWindow(windowStart, windowEnd),
    ]);
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

/** Returns business-rule-valid slots without external verification. */
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

/** Reads internal reservations; unavailable Firestore is treated as empty here. */
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
    // FreeBusy remains the authoritative external check when this read fails.
    return [];
  }
}
