import { NextResponse } from "next/server";
import {
  addCalendarDays,
  getAvailableStartTimes,
  getDateWeekday,
  getTodayInTimeZone,
  isDateWithinAvailabilityRules,
  isValidTimeZone,
  MAX_HORIZON_DAYS,
  MEETING_BUFFER_MINUTES,
  MEETING_DURATION_MINUTES,
} from "@/components/forms/date-time-constants";
import { availabilityQuerySchema } from "@/components/forms/schemas";

const ERROR_RESPONSE = {
  success: false,
  error: "AVAILABILITY_ERROR",
  message: "No se pudieron cargar los horarios disponibles.",
} as const;

type AvailabilitySlot = {
  time: string;
  available: true;
};

function hashCode(value: string) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

function generateSlots(date: string, timeZone: string, now = new Date()): AvailabilitySlot[] {
  const dateHash = hashCode(`${date}:${timeZone}`);

  return getAvailableStartTimes(date, timeZone, now)
    .filter((time) => (dateHash + hashCode(time)) % 3 !== 0)
    .map((time) => ({ time, available: true }));
}

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get("date");
  const timezone = searchParams.get("timezone");

  if (!date || !timezone || !isValidTimeZone(timezone)) {
    return NextResponse.json(ERROR_RESPONSE, { status: 400 });
  }

  const parsed = availabilityQuerySchema.safeParse({ date, timezone });

  if (!parsed.success || !isDateWithinAvailabilityRules(date, timezone)) {
    return NextResponse.json(ERROR_RESPONSE, { status: 400 });
  }

  const today = getTodayInTimeZone(timezone);
  const maximumDate = addCalendarDays(today, MAX_HORIZON_DAYS);

  return NextResponse.json({
    success: true,
    date,
    timezone,
    rules: {
      bufferMinutes: MEETING_BUFFER_MINUTES,
      durationMinutes: MEETING_DURATION_MINUTES,
      enabledWeekdays: [1, 2, 3, 4, 5, 6],
      maxDate: maximumDate,
      minLeadTimeHours: 12,
      startWeekday: getDateWeekday(date),
    },
    slots: generateSlots(date, timezone),
  });
}
