import { NextResponse } from "next/server";

import {
  GOOGLE_CALENDAR_WEBHOOK_OUTCOMES,
  handleGoogleCalendarWebhook,
} from "@/lib/meet/google-calendar-webhook";

export const dynamic = "force-dynamic";

/** Google Calendar requires a fast 2xx acknowledgement for accepted watches. */
export async function POST(request: Request) {
  const outcome = await handleGoogleCalendarWebhook(request);

  switch (outcome) {
    case GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.ACCEPTED:
      return new NextResponse(null, { status: 204 });
    case GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.INVALID:
      return NextResponse.json({ success: false, error: "INVALID_GOOGLE_NOTIFICATION" }, { status: 400 });
    case GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.UNAUTHORIZED:
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_GOOGLE_NOTIFICATION" }, { status: 401 });
    case GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.CONFIGURATION_MISSING:
    case GOOGLE_CALENDAR_WEBHOOK_OUTCOMES.UNAVAILABLE:
      return NextResponse.json({ success: false, error: "GOOGLE_CALENDAR_WEBHOOK_UNAVAILABLE" }, { status: 503 });
  }
}
