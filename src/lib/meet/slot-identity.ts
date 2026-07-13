import "server-only";

import type { SlotIdentity, Timezone } from "./domain";

export interface SlotIdentityInput {
  date: string;
  time: string;
  timezone: Timezone;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
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
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second")) - date.getTime();
}

export function getSlotIdentity({ date, time, timezone }: SlotIdentityInput): SlotIdentity {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timezone));
  const instant = new Date(localAsUtc - getTimeZoneOffsetMs(firstGuess, timezone));

  return instant.toISOString() as SlotIdentity;
}
