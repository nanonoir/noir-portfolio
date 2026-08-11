import {
  AVAILABILITY_END_MINUTES,
  AVAILABILITY_START_MINUTES,
  ENABLED_WEEKDAYS,
  MAX_HORIZON_DAYS,
  MIN_LEAD_TIME_MS,
  addCalendarDays,
  getTodayInTimezone,
  getValidStartTimes,
  getWeekday,
  isDateWithinBusinessRules,
  isValidTimeZone as isValidPolicyTimeZone,
} from "@/lib/meet/availability-policy";
import {
  MEETING_BUFFER_MINUTES,
  MEETING_DURATION_MINUTES,
  SLOT_INTERVAL_MINUTES,
} from "@/lib/meet/duration";
import { getZonedDateTime as getSharedZonedDateTime } from "@/lib/meet/zoned-date-time";
import type { Timezone } from "@/lib/meet/domain";

export {
  AVAILABILITY_END_MINUTES,
  AVAILABILITY_START_MINUTES,
  MAX_HORIZON_DAYS,
  MIN_LEAD_TIME_MS,
  MEETING_BUFFER_MINUTES,
  MEETING_DURATION_MINUTES,
  SLOT_INTERVAL_MINUTES,
};
export { ENABLED_WEEKDAYS };

export type AvailabilitySlot = {
  available: boolean;
  availabilityStatus?: "verified" | "unverified";
  endISO?: string;
  startISO?: string;
  time: string;
};

export type AvailabilityState =
  | { status: "idle"; slots: AvailabilitySlot[] }
  | { status: "loading"; slots: AvailabilitySlot[] }
  | { status: "success"; slots: AvailabilitySlot[] }
  | { status: "empty"; slots: AvailabilitySlot[] }
  | { status: "error"; slots: AvailabilitySlot[]; code?: string; message?: string };

export function getVisitorTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimeZone(timeZone: string): boolean {
  return isValidPolicyTimeZone(timeZone);
}

export function getZonedDateTime(date: string, time: string, timeZone: string): Date {
  return getSharedZonedDateTime({ date, time, timezone: timeZone as Timezone });
}

export function getTodayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return getTodayInTimezone(timeZone, now);
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export { addCalendarDays };

export function getDateWeekday(date: string): number {
  return getWeekday(date);
}

export function getAvailableStartTimes(date: string, timeZone: string, now: Date = new Date()): string[] {
  return getValidStartTimes(date, timeZone, now).map(({ time }) => time);
}

export function isDateWithinAvailabilityRules(date: string, timeZone: string, now: Date = new Date()): boolean {
  return isDateWithinBusinessRules(date, timeZone, now);
}
