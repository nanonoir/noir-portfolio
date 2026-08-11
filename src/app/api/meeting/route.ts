import { NextResponse } from "next/server";
import { mapMeetingApiPayload } from "@/lib/meet/api-meeting-mapper";
import { bookingService } from "@/lib/meet/composition";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";
import {
  PUBLIC_MEETING_RATE_LIMIT,
  REQUEST_GUARD_RESULTS,
  hasTriggeredHoneypot,
  isRateLimitAllowed,
  readBoundedJsonRequest,
} from "@/lib/meet/request-guards";

function getBookingHttpStatus(result: Awaited<ReturnType<typeof bookingService.createBooking>>) {
  if (result.success) return result.emailDeliveryStatus === "completed" ? 201 : 202;
  if (result.error === MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE) return 503;
  if (result.error === MEETING_ERROR_CODES.UPSTREAM_TIMEOUT) return 504;
  return result.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE || result.error === MEETING_ERROR_CODES.IDEMPOTENCY_CONFLICT
    ? 409
    : result.error === MEETING_ERROR_CODES.MEETING_ERROR ? 400 : 500;
}

export async function POST(request: Request) {
  if (!(await isRateLimitAllowed(request, PUBLIC_MEETING_RATE_LIMIT))) {
    meetLogger.warn("booking.route.rate_limited");
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 429 });
  }

  const body = await readBoundedJsonRequest(request);
  if (body.result !== REQUEST_GUARD_RESULTS.ALLOWED) {
    meetLogger.warn("booking.route.invalid_json", { code: body.result });
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 400 });
  }
  if (hasTriggeredHoneypot(body.payload)) {
    // Deliberately use the generic invalid-request response: bots should not
    // learn which anti-abuse control rejected their submission.
    meetLogger.warn("booking.route.honeypot_rejected");
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 400 });
  }

  const bookingRequest = mapMeetingApiPayload(body.payload);

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
