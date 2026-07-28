import { afterEach, describe, expect, it, vi } from "vitest";

import { createBookingRecordFixture } from "../../helpers/booking-factory";

const mocks = vi.hoisted(() => ({
  eventsGet: vi.fn(),
  eventsInsert: vi.fn(),
  eventsPatch: vi.fn(),
  refreshAccessToken: vi.fn(),
  createGoogleCalendarClient: vi.fn(),
}));

vi.mock("@/lib/server/env", () => ({
  getEnv: vi.fn((key: string) => ({
    GOOGLE_CALENDAR_ID: "primary",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_REFRESH_TOKEN: "refresh-token",
  })[key]),
}));
vi.mock("@/lib/server/google-calendar-client", () => ({
  PROVIDER_TIMEOUT_MS: 3_500,
  createGoogleCalendarClient: mocks.createGoogleCalendarClient,
}));
vi.mock("@/lib/server/google-oauth", () => ({ refreshAccessToken: mocks.refreshAccessToken }));
vi.mock("@/lib/meet/logger", () => ({
  meetLogger: { error: vi.fn() },
  normalizeErrorCause: vi.fn(() => "bounded-timeout"),
}));

describe("Google Calendar webhook event fetch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns the stable unavailable result when event retrieval times out", async () => {
    vi.useFakeTimers();
    const unhandledRejections: unknown[] = [];
    const captureUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    process.on("unhandledRejection", captureUnhandledRejection);
    mocks.refreshAccessToken.mockResolvedValue("access-token");
    mocks.createGoogleCalendarClient.mockReturnValue({ events: { get: mocks.eventsGet } });
    mocks.eventsGet.mockImplementation((_request, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }));
    const { fetchGoogleCalendarEvent, GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS } = await import("@/lib/server/google-calendar-provider");

    try {
      const result = fetchGoogleCalendarEvent("event-123");
      await vi.advanceTimersByTimeAsync(GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS);

      await expect(result).resolves.toBeNull();
      expect(mocks.eventsGet).toHaveBeenCalledWith(
        { calendarId: "primary", eventId: "event-123" },
        expect.objectContaining({ timeout: GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS, signal: expect.any(AbortSignal) }),
      );
      expect(mocks.eventsGet.mock.calls[0]?.[1].signal.aborted).toBe(true);
      await Promise.resolve();
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", captureUnhandledRejection);
    }
  });

  it("classifies a Google 404 event fetch as permanently missing", async () => {
    mocks.refreshAccessToken.mockResolvedValue("access-token");
    mocks.createGoogleCalendarClient.mockReturnValue({ events: { get: mocks.eventsGet } });
    mocks.eventsGet.mockRejectedValue({ code: 404 });
    const { fetchGoogleCalendarEvent, GOOGLE_CALENDAR_EVENT_FETCH_RESULTS } = await import("@/lib/server/google-calendar-provider");

    await expect(fetchGoogleCalendarEvent("deleted-event")).resolves.toBe(
      GOOGLE_CALENDAR_EVENT_FETCH_RESULTS.NOT_FOUND,
    );
  });
});

describe("Google Calendar provider request boundaries", () => {
  afterEach(() => vi.clearAllMocks());

  function configureCalendarClient() {
    mocks.refreshAccessToken.mockResolvedValue("access-token");
    mocks.createGoogleCalendarClient.mockReturnValue({
      events: {
        get: mocks.eventsGet,
        insert: mocks.eventsInsert,
        patch: mocks.eventsPatch,
      },
    });
  }

  it("applies the documented request timeout and AbortSignal to event creation", async () => {
    configureCalendarClient();
    mocks.eventsInsert.mockResolvedValue({
      data: { conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/test" }] }, id: "event-1" },
    });
    const { GoogleCalendarProvider } = await import("@/lib/server/google-calendar-provider");

    await expect(new GoogleCalendarProvider().createEvent(createBookingRecordFixture())).resolves.toMatchObject({ success: true });

    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("refresh-token", 3_500);
    expect(mocks.createGoogleCalendarClient).toHaveBeenCalledWith("access-token", 3_500);
    expect(mocks.eventsInsert).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 3_500 }),
    );
  });

  it("applies the documented request timeout and AbortSignal to event updates", async () => {
    configureCalendarClient();
    mocks.eventsPatch.mockResolvedValue({
      data: { conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/test" }] }, id: "event-1" },
    });
    const { GoogleCalendarProvider } = await import("@/lib/server/google-calendar-provider");

    await expect(new GoogleCalendarProvider().updateEvent(createBookingRecordFixture())).resolves.toMatchObject({ success: true });

    expect(mocks.eventsPatch).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 3_500 }),
    );
  });

  it("applies the documented request timeout and AbortSignal to event cancellation", async () => {
    configureCalendarClient();
    mocks.eventsPatch.mockResolvedValue({ data: { id: "event-1", status: "cancelled" } });
    const { GoogleCalendarProvider } = await import("@/lib/server/google-calendar-provider");

    await expect(new GoogleCalendarProvider().deleteEvent("event-1")).resolves.toMatchObject({ success: true });

    expect(mocks.eventsPatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "event-1", requestBody: { status: "cancelled" } }),
      expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 3_500 }),
    );
  });
});
