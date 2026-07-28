import "server-only";

import type { Timezone } from "./domain";
import {
  MEETING_BUFFER_MINUTES,
  MEETING_DURATION_MINUTES,
  SLOT_INTERVAL_MINUTES,
  addMeetingDuration,
} from "./duration";
import { getZonedDateTime, getTimeZoneOffsetMs } from "./zoned-date-time";

/**
 * Shared availability business rules (PRD §4.1).
 *
 * Phase 3 extracted these from `MockAvailabilityRepository` so the real Google
 * Calendar provider, the unverified provider, and the legacy mock all share one
 * implementation of:
 *  - Mon–Sat enabled weekdays;
 *  - 08:00–20:00 local display window with exact hourly starts;
 *  - 30-minute meetings + 30-minute effective buffer → one-hour starts;
 *  - strict >12h lead time;
 *  - 30-day inclusive maximum horizon;
 *  - DST nonexistent/ambiguous local times are not offered.
 *
 * All technical comparisons use UTC instants. Local date/time/timezone remain
 * for display and audit (PRD §4.2).
 */

export const AVAILABILITY_START_MINUTES = 8 * 60;
export const AVAILABILITY_END_MINUTES = 20 * 60;
export { MEETING_DURATION_MINUTES, SLOT_INTERVAL_MINUTES } from "./duration";
export const EFFECTIVE_BUFFER_MINUTES = MEETING_BUFFER_MINUTES;
export const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;
export const MAX_HORIZON_DAYS = 30;
export const ENABLED_WEEKDAYS = new Set([1, 2, 3, 4, 5, 6]);

/** Legacy fallback timezone per PRD §4.2 fallback order step 3. */
export const LEGACY_FALLBACK_TIMEZONE = "America/Argentina/Buenos_Aires";

function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || timezone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Coerce a possibly-invalid timezone to a valid IANA timezone using the PRD §4.2
 * fallback order: (1) provided value if valid; (2) `fallbackCandidate` if valid;
 * (3) `LEGACY_FALLBACK_TIMEZONE`. Returns `null` only if all three are invalid,
 * which cannot happen unless the constants table is broken.
 */
export function resolveTimezone(
  provided: string | null | undefined,
  fallbackCandidate: string | null | undefined,
): { timezone: Timezone | null; usedFallback: boolean } {
  if (provided && isValidIanaTimezone(provided)) {
    return { timezone: provided as Timezone, usedFallback: false };
  }
  if (fallbackCandidate && isValidIanaTimezone(fallbackCandidate)) {
    return { timezone: fallbackCandidate as Timezone, usedFallback: true };
  }
  if (isValidIanaTimezone(LEGACY_FALLBACK_TIMEZONE)) {
    return { timezone: LEGACY_FALLBACK_TIMEZONE as Timezone, usedFallback: true };
  }
  return { timezone: null, usedFallback: true };
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function getTodayInTimezone(timezone: Timezone, now: Date = new Date()): string {
  return formatDateInTimeZone(now, timezone);
}

export function getWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isCalendarDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date;
}

export function getHorizonMax(today: string): string {
  return addCalendarDays(today, MAX_HORIZON_DAYS);
}

function formatInstantInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/**
 * Returns true when the requested local date/time exists exactly once in the
 * timezone. Detects both nonexistent (spring-forward gap) and ambiguous
 * (fall-back duplicate) DST local times per PRD §4.2.
 *
 *  - Nonexistent gap: round-tripping the computed UTC instant through the
 *    timezone does not yield the requested wall `HH:mm`.
 *  - Ambiguous fall-back: the UTC offset for the slot instant differs from
 *    the offset one hour later, indicating the wall clock is in a transition
 *    window where the same `HH:mm` occurs twice.
 */
export function isValidZonedDateTime(date: string, time: string, timezone: Timezone): boolean {
  const instant = getZonedDateTime({ date, time, timezone });
  if (Number.isNaN(instant.getTime())) return false;

  if (formatInstantInZone(instant, timezone) !== time) return false;

  const offsetBefore = getTimeZoneOffsetMs(instant, timezone);
  const offsetAfter = getTimeZoneOffsetMs(new Date(instant.getTime() + 60 * 60 * 1000), timezone);
  if (offsetBefore !== offsetAfter) return false;

  return true;
}

export function isDateWithinBusinessRules(date: string, timezone: Timezone, now: Date = new Date()): boolean {
  if (!isCalendarDate(date)) return false;
  const today = getTodayInTimezone(timezone, now);
  return (
    ENABLED_WEEKDAYS.has(getWeekday(date)) &&
    date >= today &&
    date <= getHorizonMax(today) &&
    getValidStartTimes(date, timezone, now).length > 0
  );
}

export interface AvailabilitySlotCandidate {
  time: string;
  startISO: string;
  endISO: string;
}

export function getValidStartTimes(
  date: string,
  timezone: Timezone,
  now: Date = new Date(),
): AvailabilitySlotCandidate[] {
  const candidates: AvailabilitySlotCandidate[] = [];

  for (
    let minutes = AVAILABILITY_START_MINUTES;
    minutes <= AVAILABILITY_END_MINUTES - MEETING_DURATION_MINUTES;
    minutes += SLOT_INTERVAL_MINUTES
  ) {
    const time = `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

    if (!isValidZonedDateTime(date, time, timezone)) continue;

    const startInstant = getZonedDateTime({ date, time, timezone });
    if (startInstant.getTime() < now.getTime() + MIN_LEAD_TIME_MS) continue;

    const endInstant = addMeetingDuration(startInstant);

    candidates.push({
      time,
      startISO: startInstant.toISOString(),
      endISO: endInstant.toISOString(),
    });
  }

  return candidates;
}
