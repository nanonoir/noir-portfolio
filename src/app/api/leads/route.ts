import { NextResponse } from "next/server";

import { leadSubmissionSchema } from "@/lib/leads/lead-model";
import { sendLeadOwnerNotification } from "@/lib/leads/resend-lead-email-provider";
import {
  PUBLIC_MEETING_RATE_LIMIT,
  REQUEST_GUARD_RESULTS,
  hasTriggeredHoneypot,
  isRateLimitAllowed,
  readBoundedJsonRequest,
} from "@/lib/meet/request-guards";

const LEAD_ERROR = "LEAD_ERROR";

export async function POST(request: Request) {
  if (!(await isRateLimitAllowed(request, PUBLIC_MEETING_RATE_LIMIT))) {
    return NextResponse.json({ success: false, error: LEAD_ERROR }, { status: 429 });
  }

  const body = await readBoundedJsonRequest(request);
  if (body.result !== REQUEST_GUARD_RESULTS.ALLOWED || hasTriggeredHoneypot(body.payload)) {
    return NextResponse.json({ success: false, error: LEAD_ERROR }, { status: 400 });
  }

  const parsed = leadSubmissionSchema.safeParse(body.payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: LEAD_ERROR }, { status: 400 });
  }

  const delivery = await sendLeadOwnerNotification({ ...parsed.data, submittedAt: new Date().toISOString() });
  if (!delivery.success) {
    return NextResponse.json({ success: false, error: LEAD_ERROR }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
