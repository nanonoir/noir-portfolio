import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  isBackendE2ETestComposition: () => false,
  isFirebaseConfigured: () => false,
  isGoogleCalendarWebhookConfigured: () => false,
  isResendConfigured: () => false,
}));
vi.mock("@/lib/meet/webhook-config", () => ({
  getGoogleWebhookHealth: async () => ({ status: "not_configured" }),
}));
vi.mock("@/lib/meet/health-aggregates", () => ({
  getMeetHealthAggregates: async () => ({
    actionTokenLeases: { stale: null, status: "unavailable" },
    deliveries: { calendarFailed: null, emailFailed: null, retryable: null, status: "unavailable" },
    webhookNotificationLeases: { stale: null, status: "unavailable" },
  }),
}));

describe("GET /api/health", () => {
  it("returns safe configuration states without provider secrets", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      config: { firebase: "not_configured", googleCalendarWebhook: "not_configured", resend: "not_configured" },
      operational: {
        actionTokenLeases: { stale: null, status: "unavailable" },
        deliveries: { calendarFailed: null, emailFailed: null, retryable: null, status: "unavailable" },
        webhookNotificationLeases: { stale: null, status: "unavailable" },
      },
      service: "noir-portfolio",
      status: "degraded",
      webhook: { status: "not_configured" },
    });
    expect(JSON.stringify(body)).not.toMatch(/private|secret|raw-action-token/i);
  });
});
