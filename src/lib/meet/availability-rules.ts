import "server-only";

import { isValidTimeZone } from "./availability-policy";

export {
  AVAILABILITY_END_MINUTES,
  AVAILABILITY_START_MINUTES,
  EFFECTIVE_BUFFER_MINUTES,
  MAX_HORIZON_DAYS,
  MIN_LEAD_TIME_MS,
  addCalendarDays,
  getHorizonMax,
  getTodayInTimezone,
  getValidStartTimes,
  getWeekday,
  isCalendarDate,
  isDateWithinBusinessRules,
  isValidZonedDateTime,
  type AvailabilitySlotCandidate,
} from "./availability-policy";
export { MEETING_DURATION_MINUTES, SLOT_INTERVAL_MINUTES } from "./duration";
export const ENABLED_WEEKDAYS = new Set([1, 2, 3, 4, 5, 6]);
export const LEGACY_FALLBACK_TIMEZONE = "America/Argentina/Buenos_Aires";

export function resolveTimezone(
  provided: string | null | undefined,
  fallbackCandidate: string | null | undefined,
): { timezone: import("./domain").Timezone | null; usedFallback: boolean } {
  if (provided && isValidTimeZone(provided)) {
    return { timezone: provided as import("./domain").Timezone, usedFallback: false };
  }
  if (fallbackCandidate && isValidTimeZone(fallbackCandidate)) {
    return { timezone: fallbackCandidate as import("./domain").Timezone, usedFallback: true };
  }
  if (isValidTimeZone(LEGACY_FALLBACK_TIMEZONE)) {
    return { timezone: LEGACY_FALLBACK_TIMEZONE as import("./domain").Timezone, usedFallback: true };
  }
  return { timezone: null, usedFallback: true };
}
