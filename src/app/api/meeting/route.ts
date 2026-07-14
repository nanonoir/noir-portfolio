import { NextResponse } from "next/server";
import { mapMeetingApiPayload } from "@/lib/meet/api-meeting-mapper";
import { bookingService } from "@/lib/meet/booking-service";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

function getBookingHttpStatus(result: Awaited<ReturnType<typeof bookingService.createBooking>>) {
  if (result.success) return 201;
  return result.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE || result.error === MEETING_ERROR_CODES.IDEMPOTENCY_CONFLICT
    ? 409
    : 400;
}

export async function POST(request: Request) {
  let payload: unknown = undefined;

  try {
    payload = await request.json();
  } catch (error) {
    payload = undefined;
    meetLogger.warn("booking.route.invalid_json", { cause: normalizeErrorCause(error) });
  }

  const bookingRequest = mapMeetingApiPayload(payload);

  if (!bookingRequest) {
    meetLogger.warn("booking.route.invalid_request");
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 400 });
  }

  try {
    meetLogger.info("booking.route.request", { idempotencyKey: bookingRequest.idempotencyKey });
    const result = await bookingService.createBooking(bookingRequest);
    const status = getBookingHttpStatus(result);

    meetLogger.info("booking.route.response", { code: result.success ? result.code : result.error, status });
    return NextResponse.json(result, { status });
  } catch (error) {
    meetLogger.error("booking.route.unexpected_error", {
      cause: normalizeErrorCause(error),
      idempotencyKey: bookingRequest.idempotencyKey,
    });
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 500 });
  }
}
