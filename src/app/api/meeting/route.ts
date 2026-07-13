import { NextResponse } from "next/server";
import { mapMeetingApiPayload } from "@/lib/meet/api-meeting-mapper";
import { bookingService } from "@/lib/meet/booking-service";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";

function getBookingHttpStatus(result: Awaited<ReturnType<typeof bookingService.createBooking>>) {
  if (result.success) return 201;
  return result.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE ? 409 : 400;
}

export async function POST(request: Request) {
  let payload: unknown = undefined;

  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }

  const bookingRequest = mapMeetingApiPayload(payload);

  if (!bookingRequest) {
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 400 });
  }

  try {
    const result = await bookingService.createBooking(bookingRequest);

    return NextResponse.json(result, { status: getBookingHttpStatus(result) });
  } catch {
    return NextResponse.json({ success: false, error: MEETING_ERROR_CODES.MEETING_ERROR }, { status: 500 });
  }
}
