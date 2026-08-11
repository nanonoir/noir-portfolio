import { NextResponse } from "next/server";

import { availabilityService } from "@/lib/meet/availability-service";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

function getStatusForError(error: string): number {
  if (error === MEETING_ERROR_CODES.INVALID_TIMEZONE) return 400;
  if (error === MEETING_ERROR_CODES.AVAILABILITY_UNAVAILABLE) return 503;
  return 400;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const timezoneParam = searchParams.get("timezone");
  const timezoneHeader = request.headers.get("x-timezone");

  // Prefer the query value; the service applies header and legacy fallbacks.
  const timezone = timezoneParam ?? timezoneHeader;

  try {
    const result = await availabilityService.getAvailability({
      date: searchParams.get("date"),
      timezone,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : getStatusForError(result.error),
    });
  } catch (error) {
    meetLogger.error("availability.route.unexpected_error", { cause: normalizeErrorCause(error) });
    return NextResponse.json(
      { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_UNAVAILABLE },
      { status: 503 },
    );
  }
}
