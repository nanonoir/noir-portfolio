import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Timezone } from "@/lib/meet/domain";

const UTC_TIMEZONE = "UTC" as Timezone;

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  queryPrimaryCalendarFreeBusy: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock("@/lib/server/env", () => ({ isFirebaseConfigured: () => true }));
vi.mock("@/lib/server/google-calendar-freebusy", () => ({
  queryPrimaryCalendarFreeBusy: mocks.queryPrimaryCalendarFreeBusy,
}));
vi.mock("@/lib/server/firestore", () => ({ getFirestore: mocks.getFirestore }));

describe("Google availability Firestore reservation read", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
    mocks.queryPrimaryCalendarFreeBusy.mockResolvedValue([]);
    const query = { where: vi.fn(), get: mocks.get };
    query.where.mockReturnValue(query);
    mocks.getFirestore.mockReturnValue({ collection: vi.fn(() => query) });
    mocks.get.mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns the existing safe empty-reservation fallback when the range query times out", async () => {
    const { GoogleCalendarAvailabilityProvider } = await import("@/lib/meet/availability-providers");
    const result = new GoogleCalendarAvailabilityProvider().getSlots({ date: "2026-08-05", timezone: UTC_TIMEZONE });
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(result).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ availabilityStatus: "verified" }),
    ]));
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
