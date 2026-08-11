import type { Timezone } from "./domain";
import {
  MEETING_BUFFER_MINUTES,
  MEETING_DURATION_MINUTES,
  SLOT_INTERVAL_MINUTES,
  addMeetingDuration,
} from "./duration";
import { getTimeZoneOffsetMs, getZonedDateTime } from "./zoned-date-time";

export const AVAILABILITY_START_MINUTES = 8 * 60;
export const AVAILABILITY_END_MINUTES = 20 * 60;
export const EFFECTIVE_BUFFER_MINUTES = MEETING_BUFFER_MINUTES;
export const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;
export const MAX_HORIZON_DAYS = 30;
export const ENABLED_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

export interface AvailabilitySlotCandidate {
  time: string;
  startISO: string;
  endISO: string;
}

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone || timezone.trim() === "") return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function getTodayInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
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

function formatInstantInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: timezone,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function isValidZonedDateTime(date: string, time: string, timezone: string): boolean {
  if (!isCalendarDate(date) || !isValidTimeZone(timezone)) return false;

  const zonedTimezone = timezone as Timezone;
  const instant = getZonedDateTime({ date, time, timezone: zonedTimezone });
  if (Number.isNaN(instant.getTime()) || formatInstantInZone(instant, timezone) !== time) return false;

  return getTimeZoneOffsetMs(instant, timezone) === getTimeZoneOffsetMs(new Date(instant.getTime() + 60 * 60 * 1000), timezone);
}

export function isDateWithinBusinessRules(date: string, timezone: string, now: Date = new Date()): boolean {
  if (!isCalendarDate(date) || !isValidTimeZone(timezone)) return false;

  const today = getTodayInTimezone(timezone, now);
  return (
    ENABLED_WEEKDAYS.includes(getWeekday(date) as (typeof ENABLED_WEEKDAYS)[number]) &&
    date >= today &&
    date <= getHorizonMax(today) &&
    getValidStartTimes(date, timezone, now).length > 0
  );
}

export function getValidStartTimes(
  date: string,
  timezone: string,
  now: Date = new Date(),
): AvailabilitySlotCandidate[] {
  if (!isCalendarDate(date) || !isValidTimeZone(timezone)) return [];

  const zonedTimezone = timezone as Timezone;
  const candidates: AvailabilitySlotCandidate[] = [];

  for (
    let minutes = AVAILABILITY_START_MINUTES;
    minutes <= AVAILABILITY_END_MINUTES - MEETING_DURATION_MINUTES;
    minutes += SLOT_INTERVAL_MINUTES
  ) {
    const time = `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
    if (!isValidZonedDateTime(date, time, timezone)) continue;

    const startInstant = getZonedDateTime({ date, time, timezone: zonedTimezone });
    if (startInstant.getTime() < now.getTime() + MIN_LEAD_TIME_MS) continue;

    candidates.push({
      time,
      startISO: startInstant.toISOString(),
      endISO: addMeetingDuration(startInstant).toISOString(),
    });
  }

  return candidates;
}
