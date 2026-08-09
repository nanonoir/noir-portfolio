import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAvailability: vi.fn() }));

// Keep route parsing and HTTP error mapping real; mock only the service boundary.
vi.mock("@/lib/meet/availability-service", () => ({
  availabilityService: { getAvailability: mocks.getAvailability },
}));

describe("availability HTTP error contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps an INVALID_TIMEZONE service result to the stable 400 route contract", async () => {
    mocks.getAvailability.mockResolvedValue({ error: "INVALID_TIMEZONE", success: false });
    const { GET } = await import("@/app/api/availability/route");

    const response = await GET(new Request("http://localhost/api/availability?date=2026-08-05&timezone=Invalid%2FTimezone"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: "INVALID_TIMEZONE" });
    expect(mocks.getAvailability).toHaveBeenCalledWith({ date: "2026-08-05", timezone: "Invalid/Timezone" });
  });

  it("maps an unexpected availability service exception to 503 AVAILABILITY_UNAVAILABLE", async () => {
    mocks.getAvailability.mockRejectedValue(new Error("private provider details"));
    const { GET } = await import("@/app/api/availability/route");

    const response = await GET(new Request("http://localhost/api/availability?date=2026-08-05&timezone=UTC"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: "AVAILABILITY_UNAVAILABLE" });
  });
});
