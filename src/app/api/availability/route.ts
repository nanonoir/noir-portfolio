import { NextResponse } from "next/server";
import { availabilityService } from "@/lib/meet/availability-service";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const result = await availabilityService.getAvailability({
      date: searchParams.get("date"),
      timezone: searchParams.get("timezone") ?? request.headers.get("x-timezone"),
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    meetLogger.error("availability.route.unexpected_error", { cause: normalizeErrorCause(error) });
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR }, { status: 500 });
  }
}
