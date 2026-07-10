import { NextResponse } from "next/server";

const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Minimum lead time in milliseconds — must match the client-side constant. */
const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;

const ERROR_RESPONSE = {
  success: false,
  error: "AVAILABILITY_ERROR",
  message: "No se pudieron cargar los horarios disponibles.",
} as const;

type AvailabilitySlot = {
  time: string;
  available: true;
};

const baseTimes = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
] as const;

function hashCode(value: string) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day, date };
}

function getBuenosAiresToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

function getSlotDate(date: string, time: string) {
  const parsedDate = parseDate(date);

  if (!parsedDate) {
    return null;
  }

  const [hour, minute] = time.split(":").map(Number);

  return new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour + 3, minute));
}

function isValidDate(date: string, now = new Date()) {
  const parsedDate = parseDate(date);

  if (!parsedDate) {
    return false;
  }

  const day = parsedDate.date.getUTCDay();

  if (day === 0 || day === 6) {
    return false;
  }

  const today = getBuenosAiresToday(now);
  const maxDate = new Date(today);
  maxDate.setUTCDate(today.getUTCDate() + 14);

  if (parsedDate.date < today || parsedDate.date > maxDate) {
    return false;
  }

  return baseTimes.some((time) => {
    const slotDate = getSlotDate(date, time);

    return slotDate ? slotDate.getTime() >= now.getTime() + MIN_LEAD_TIME_MS : false;
  });
}

function generateSlots(date: string, now = new Date()): AvailabilitySlot[] {
  const dateHash = hashCode(date);

  return baseTimes
    .map((time) => ({
      time,
      available: (dateHash + hashCode(time)) % 3 !== 0,
    }))
    .filter((slot) => {
      const slotDate = getSlotDate(date, slot.time);

      return slot.available && slotDate && slotDate.getTime() >= now.getTime() + MIN_LEAD_TIME_MS;
    })
    .map(({ time }) => ({ time, available: true }));
}

export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");

  if (!date || !isValidDate(date)) {
    return NextResponse.json(ERROR_RESPONSE, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    date,
    timezone: TIMEZONE,
    slots: generateSlots(date),
  });
}
