export const AVAILABILITY_START_MINUTES = 8 * 60;
export const AVAILABILITY_END_MINUTES = 20 * 60;
export const MEETING_DURATION_MINUTES = 30;
export const MEETING_BUFFER_MINUTES = 30;
export const SLOT_INTERVAL_MINUTES = MEETING_DURATION_MINUTES + MEETING_BUFFER_MINUTES;
export const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;
export const MAX_HORIZON_DAYS = 30;
export const ENABLED_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

export type AvailabilitySlot = {
  time: string;
  available: boolean;
};

export type AvailabilityState =
  | { status: "idle"; slots: AvailabilitySlot[] }
  | { status: "loading"; slots: AvailabilitySlot[] }
  | { status: "success"; slots: AvailabilitySlot[] }
  | { status: "empty"; slots: AvailabilitySlot[] }
  | { status: "error"; slots: AvailabilitySlot[]; message?: string };

export function getVisitorTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value),
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    second: Number(parts.find((part) => part.type === "second")?.value),
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const displayedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return displayedAsUtc - date.getTime();
}

export function getZonedDateTime(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(new Date(localAsUtc), timeZone);
  const firstGuess = new Date(localAsUtc - firstOffset);
  const correctedOffset = getTimeZoneOffsetMs(firstGuess, timeZone);

  return new Date(localAsUtc - correctedOffset);
}

export function getTodayInTimeZone(timeZone: string, now = new Date()) {
  const parts = getTimeZoneParts(now, timeZone);

  return formatIsoDate(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  result.setUTCDate(result.getUTCDate() + days);

  return formatIsoDate(result);
}

export function getDateWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getAvailableStartTimes(date: string, timeZone: string, now = new Date()) {
  const times: string[] = [];

  for (
    let minutes = AVAILABILITY_START_MINUTES;
    minutes <= AVAILABILITY_END_MINUTES - MEETING_DURATION_MINUTES;
    minutes += SLOT_INTERVAL_MINUTES
  ) {
    const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
    const minute = (minutes % 60).toString().padStart(2, "0");
    const time = `${hour}:${minute}`;
    const instant = getZonedDateTime(date, time, timeZone);

    if (instant.getTime() >= now.getTime() + MIN_LEAD_TIME_MS) {
      times.push(time);
    }
  }

  return times;
}

export function isDateWithinAvailabilityRules(date: string, timeZone: string, now = new Date()) {
  const today = getTodayInTimeZone(timeZone, now);
  const maximum = addCalendarDays(today, MAX_HORIZON_DAYS);
  const weekday = getDateWeekday(date);

  return (
    ENABLED_WEEKDAYS.includes(weekday as (typeof ENABLED_WEEKDAYS)[number]) &&
    date >= today &&
    date <= maximum &&
    getAvailableStartTimes(date, timeZone, now).length > 0
  );
}
