import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  fetchEvent: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/meet/composition", () => ({
  bookingRepository: {
    claimCalendarWebhookNotification: mocks.claim,
    completeCalendarWebhookNotification: mocks.complete,
    releaseCalendarWebhookNotification: mocks.release,
  },
}));
vi.mock("@/lib/meet/logger", () => ({
  meetLogger: { error: vi.fn(), warn: vi.fn() },
  normalizeErrorCause: vi.fn(() => ({ type: "error" })),
}));
vi.mock("@/lib/server/env", () => ({
  getEnv: vi.fn((key: string) => ({
    GOOGLE_CALENDAR_WEBHOOK_CHANNEL_ID: "channel-1",
    GOOGLE_CALENDAR_WEBHOOK_RESOURCE_ID: "resource-1",
    GOOGLE_CALENDAR_WEBHOOK_TOKEN: "token-1",
  })[key]),
  isBackendE2ETestComposition: vi.fn(() => false),
  isFirebaseConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/server/google-calendar-provider", () => ({
  GOOGLE_CALENDAR_EVENT_FETCH_RESULTS: { NOT_FOUND: "not_found" },
  GOOGLE_CALENDAR_RSVP_STATUSES: {
    ACCEPTED: "accepted",
    DECLINED: "declined",
    NEEDS_ACTION: "needsAction",
    TENTATIVE: "tentative",
  },
  fetchGoogleCalendarEvent: mocks.fetchEvent,
  isGoogleCalendarConfigured: vi.fn(() => true),
}));

function notificationRequest() {
  return new Request("http://localhost/api/integrations/google-calendar/webhook", {
    headers: {
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": "token-1",
      "x-goog-message-number": "42",
      "x-goog-resource-id": "resource-1",
      "x-goog-resource-state": "exists",
      "x-goog-resource-uri": "https://www.googleapis.com/calendar/v3/calendars/primary/events/event-1",
    },
    method: "POST",
  });
}

describe("Google Calendar webhook retry contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claim.mockResolvedValue(true);
    mocks.complete.mockResolvedValue(true);
    mocks.release.mockResolvedValue(undefined);
  });

  it("releases an owned claim and returns retryable 503 after a bounded provider timeout", async () => {
    mocks.fetchEvent.mockResolvedValue(null);
    const { POST } = await import("@/app/api/integrations/google-calendar/webhook/route");

    const response = await POST(notificationRequest());

    expect(response.status).toBe(503);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("completes and acknowledges a permanently deleted Calendar event without retrying", async () => {
    mocks.fetchEvent.mockResolvedValue("not_found");
    const { POST } = await import("@/app/api/integrations/google-calendar/webhook/route");

    const response = await POST(notificationRequest());

    expect(response.status).toBe(204);
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("acknowledges only a fresh duplicate claim without repeating provider work", async () => {
    mocks.claim.mockResolvedValue(false);
    const { POST } = await import("@/app/api/integrations/google-calendar/webhook/route");

    const response = await POST(notificationRequest());

    expect(response.status).toBe(204);
    expect(mocks.fetchEvent).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });
});
