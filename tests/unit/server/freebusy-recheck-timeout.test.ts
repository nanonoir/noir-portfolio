import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock("@/lib/server/env", () => ({ isFirebaseConfigured: () => true }));
vi.mock("@/lib/server/google-calendar-freebusy", () => ({
  isFreeBusyConfigured: () => false,
  queryPrimaryCalendarFreeBusy: vi.fn(),
}));
vi.mock("@/lib/server/firestore", () => ({ getFirestore: mocks.getFirestore }));

describe("authoritative FreeBusy Firestore recheck", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("fails closed with the controlled unavailable result when the reservation document read times out", async () => {
    vi.useFakeTimers();
    mocks.get.mockImplementation(() => new Promise(() => undefined));
    mocks.getFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: mocks.get })) })),
    });
    const { authoritativeFreeBusyRecheck } = await import("@/lib/server/freebusy-recheck");

    const result = authoritativeFreeBusyRecheck({
      startISO: "2026-08-05T12:00:00.000Z",
      meetingId: "meeting-123",
    });
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(result).resolves.toEqual({ available: false, reason: "freebusy_unavailable" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
