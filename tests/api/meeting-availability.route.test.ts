import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingService } from "@/lib/meet/booking-service";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import { createBookingRequest } from "../helpers/booking-factory";

const mocks = vi.hoisted(() => ({ createBooking: vi.fn() }));

vi.mock("@/lib/meet/composition", () => ({
  bookingService: { createBooking: mocks.createBooking },
}));
vi.mock("@/lib/server/env", () => ({
  getEnv: () => undefined,
  isBackendE2ETestComposition: () => false,
  isFirebaseConfigured: () => false,
}));

let requestSequence = 0;

function meetingRequest(body: BodyInit | null, init: RequestInit = {}) {
  requestSequence += 1;
  return new Request("http://localhost/api/meeting", {
    ...init,
    body,
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": `203.0.113.${requestSequence}`,
      ...init.headers,
    },
    method: "POST",
  });
}

describe("availability and meeting HTTP contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the real availability service for timezone, date, and minimum-lead-time boundaries", async () => {
    const { GET } = await import("@/app/api/availability/route");

    const tooSoon = await GET(new Request("http://localhost/api/availability?date=2026-08-03&timezone=UTC"));
    const available = await GET(new Request("http://localhost/api/availability?date=2026-08-05&timezone=UTC"));
    const invalidDate = await GET(new Request("http://localhost/api/availability?date=not-a-date&timezone=UTC"));
    const headerTimezone = await GET(new Request("http://localhost/api/availability?date=2026-08-05", { headers: { "x-timezone": "UTC" } }));

    expect(tooSoon.status).toBe(400);
    expect(await tooSoon.json()).toEqual({ success: false, error: "AVAILABILITY_ERROR" });
    expect(available.status).toBe(200);
    expect(await available.json()).toMatchObject({ code: "AVAILABILITY_AVAILABLE", date: "2026-08-05", success: true, timezone: "UTC" });
    expect(invalidDate.status).toBe(400);
    expect(await invalidDate.json()).toEqual({ success: false, error: "AVAILABILITY_ERROR" });
    expect(headerTimezone.status).toBe(200);
    expect(await headerTimezone.json()).toMatchObject({ date: "2026-08-05", success: true, timezone: "UTC" });
  });

  it("maps real JSON through the booking payload mapper before the composition boundary", async () => {
    mocks.createBooking.mockResolvedValue({
      code: "REQUEST_ACCEPTED",
      emailDeliveryStatus: "completed",
      meetingId: "meet-1",
      status: "requested",
      success: true,
    });
    const { POST } = await import("@/app/api/meeting/route");
    const payload = createBookingRequest();

    const response = await POST(meetingRequest(JSON.stringify(payload)));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      code: "REQUEST_ACCEPTED",
      emailDeliveryStatus: "completed",
      meetingId: "meet-1",
      status: "requested",
      success: true,
    });
    expect(mocks.createBooking).toHaveBeenCalledWith(payload);
  });

  it("returns a sanitized retryable outcome when initial owner notification delivery is incomplete", async () => {
    mocks.createBooking.mockResolvedValue({ error: "PROVIDER_UNAVAILABLE", success: false });
    const { POST } = await import("@/app/api/meeting/route");

    const response = await POST(meetingRequest(JSON.stringify(createBookingRequest())));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "PROVIDER_UNAVAILABLE", success: false });
  });

  it("maps a bounded FreeBusy provider exception through BookingService to a retryable 503", async () => {
    const { FreeBusyError } = await import("@/lib/server/google-calendar-freebusy");
    const bookingService = new BookingService({
      isAvailableDate: () => true,
      async getSlots() {
        throw new FreeBusyError("Google request timed out", "FREEBUSY_PROVIDER_ERROR");
      },
    }, new MockBookingRepository());
    mocks.createBooking.mockImplementation((request) => bookingService.createBooking(request));
    const { POST } = await import("@/app/api/meeting/route");

    const response = await POST(meetingRequest(JSON.stringify(createBookingRequest())));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "PROVIDER_UNAVAILABLE", success: false });
  });

  it("rejects real invalid JSON, oversized bodies, invalid mappings, and honeypots before booking", async () => {
    const { POST } = await import("@/app/api/meeting/route");
    const payload = createBookingRequest();

    const invalidJson = await POST(meetingRequest("{invalid"));
    const oversized = await POST(meetingRequest(JSON.stringify({ ...payload, identity: { ...payload.identity, message: "x".repeat(33 * 1024) } })));
    const invalidMapping = await POST(meetingRequest(JSON.stringify({ ...payload, meeting: { ...payload.meeting, time: "25:00" } })));
    const honeypot = await POST(meetingRequest(JSON.stringify({ ...payload, website_url: "https://bot.example" })));

    for (const response of [invalidJson, oversized, invalidMapping, honeypot]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: "MEETING_ERROR" });
    }
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("enforces the real process-local POST /api/meeting rate limit before the composition boundary", async () => {
    const { POST } = await import("@/app/api/meeting/route");
    const payload = createBookingRequest();
    const ip = `192.0.2.${requestSequence + 1}`;
    mocks.createBooking.mockResolvedValue({
      code: "REQUEST_ACCEPTED",
      emailDeliveryStatus: "completed",
      meetingId: "meet-rate-limit",
      status: "requested",
      success: true,
    });

    const responses = await Promise.all(Array.from({ length: 11 }, () => POST(meetingRequest(JSON.stringify(payload), {
      headers: { "x-vercel-forwarded-for": ip },
    }))));

    expect(responses.slice(0, 10).every((response) => response.status === 201)).toBe(true);
    expect(responses[10].status).toBe(429);
    expect(await responses[10].json()).toEqual({ success: false, error: "MEETING_ERROR" });
    expect(mocks.createBooking).toHaveBeenCalledTimes(10);
  });

  it("preserves slot conflicts and generic composition failures as stable HTTP responses", async () => {
    const { POST } = await import("@/app/api/meeting/route");
    const payload = createBookingRequest();
    mocks.createBooking
      .mockResolvedValueOnce({ error: "SLOT_UNAVAILABLE", success: false })
      .mockRejectedValueOnce(new Error("private provider details"));

    const conflict = await POST(meetingRequest(JSON.stringify(payload)));
    const unavailable = await POST(meetingRequest(JSON.stringify({ ...payload, idempotencyKey: "00000000-0000-4000-8000-000000000002" })));

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ success: false, error: "SLOT_UNAVAILABLE" });
    expect(unavailable.status).toBe(500);
    expect(await unavailable.json()).toEqual({ success: false, error: "MEETING_ERROR" });
  });
});
