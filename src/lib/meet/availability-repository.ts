import "server-only";

import type { Slot, Timezone } from "./domain";
import { getZonedDateTime } from "./zoned-date-time";

const AVAILABILITY_START_MINUTES = 8 * 60;
const AVAILABILITY_END_MINUTES = 20 * 60;
const MEETING_DURATION_MINUTES = 30;
const EFFECTIVE_BUFFER_MINUTES = 30;
const SLOT_INTERVAL_MINUTES = MEETING_DURATION_MINUTES + EFFECTIVE_BUFFER_MINUTES;
const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;
const MAX_HORIZON_DAYS = 30;
const ENABLED_WEEKDAYS = new Set([1, 2, 3, 4, 5, 6]);

export type AvailabilityQuery = {
  date: string;
  timezone: Timezone;
};

export interface AvailabilityRepository {
  getSlots(query: AvailabilityQuery): Promise<Slot[]>;
  isAvailableDate(query: AvailabilityQuery): boolean;
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
  const result = new Date(Date.UTC(year, month - 1, day + days));

  return result.toISOString().slice(0, 10);
}

function getWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isCalendarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date;
}

function hashCode(value: string) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

export class MockAvailabilityRepository implements AvailabilityRepository {
  constructor(private readonly now: () => Date = () => new Date()) {}

  isAvailableDate({ date, timezone }: AvailabilityQuery) {
    const now = this.now();
    const today = formatDateInTimeZone(now, timezone);

    return (
      isCalendarDate(date) &&
      ENABLED_WEEKDAYS.has(getWeekday(date)) &&
      date >= today &&
      date <= addCalendarDays(today, MAX_HORIZON_DAYS) &&
      this.getStartTimes(date, timezone, now).length > 0
    );
  }

  async getSlots({ date, timezone }: AvailabilityQuery): Promise<Slot[]> {
    const now = this.now();

    if (!this.isAvailableDate({ date, timezone })) {
      return [];
    }

    const dateHash = hashCode(`${date}:${timezone}`);

    return this.getStartTimes(date, timezone, now)
      .filter((time) => (dateHash + hashCode(time)) % 3 !== 0)
      .map((time) => ({ time, available: true }));
  }

  private getStartTimes(date: string, timezone: Timezone, now: Date) {
    const times: string[] = [];

    for (
      let minutes = AVAILABILITY_START_MINUTES;
      minutes <= AVAILABILITY_END_MINUTES - MEETING_DURATION_MINUTES;
      minutes += SLOT_INTERVAL_MINUTES
    ) {
      const time = `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

      if (getZonedDateTime({ date, time, timezone }).getTime() >= now.getTime() + MIN_LEAD_TIME_MS) {
        times.push(time);
      }
    }

    return times;
  }
}
