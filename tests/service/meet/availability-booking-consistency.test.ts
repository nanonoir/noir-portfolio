import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvailabilityService, createAvailabilityRepository } from "@/lib/meet/availability-service";
import { BookingService } from "@/lib/meet/booking-service";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import { UnverifiedAvailabilityProvider } from "@/lib/meet/availability-providers";
import { createBookingRequest } from "../../helpers/booking-factory";

vi.mock("@/lib/server/env", () => ({
  getEnv: (key: string) => ({
    APP_BASE_URL: "https://portfolio.example.test",
    CONTACT_TO_EMAIL: "owner@example.test",
  })[key],
  isBackendE2ETestComposition: () => false,
  isFirebaseConfigured: () => true,
}));

describe("availability and booking consistency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts an offered canonical UTC slot through the same safe-degraded provider", async () => {
    const availabilityRepository = createAvailabilityRepository();
    expect(availabilityRepository).toBeInstanceOf(UnverifiedAvailabilityProvider);

    const availability = await new AvailabilityService(availabilityRepository).getAvailability({
      date: "2026-08-05",
      timezone: "UTC",
    });
    expect(availability).toMatchObject({ success: true });
    if (!availability.success) throw new Error("Expected availability");
    const slot = availability.slots[0];
    if (!slot) throw new Error("Expected an offered slot");

    const booking = await new BookingService(availabilityRepository, new MockBookingRepository()).createBooking(
      createBookingRequest({
        idempotencyKey: "00000000-0000-4000-8000-000000000011",
        meetingDate: availability.date,
        meetingTime: slot.time,
      }),
    );

    expect(slot.startISO).toBeDefined();
    expect(booking).toMatchObject({ success: true, status: "requested" });
  });
});
