import { NextResponse } from "next/server";

import {
  isFirebaseConfigured,
  isGoogleCalendarWebhookConfigured,
  isResendConfigured,
} from "@/lib/server/env";
import { getGoogleWebhookHealth } from "@/lib/meet/webhook-config";
import { getMeetHealthAggregates } from "@/lib/meet/health-aggregates";

export const dynamic = "force-dynamic";

/**
 * Basic deployment health check.
 *
 * Does not probe external providers and does not expose secrets. The
 * `config` block only reports whether required server env vars are present,
 * not their values. This keeps the endpoint safe to expose on Vercel Free.
 */
export async function GET() {
  const [webhook, operational] = await Promise.all([
    getGoogleWebhookHealth(),
    getMeetHealthAggregates(),
  ]);
  const operationalAvailable = operational.actionTokenLeases.status === "available"
    && operational.webhookNotificationLeases.status === "available"
    && operational.deliveries.status === "available";
  return NextResponse.json(
    {
      status: operationalAvailable ? "ok" : "degraded",
      service: "noir-portfolio",
      timestamp: new Date().toISOString(),
      config: {
        firebase: isFirebaseConfigured() ? "configured" : "not_configured",
        googleCalendarWebhook: isGoogleCalendarWebhookConfigured() ? "configured" : "not_configured",
        resend: isResendConfigured() ? "configured" : "not_configured",
      },
      operational,
      webhook,
    },
    { status: 200 },
  );
}
