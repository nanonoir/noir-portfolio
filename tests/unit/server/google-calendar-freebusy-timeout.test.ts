import { afterEach, describe, expect, it, vi } from "vitest";
import type { FreeBusyError } from "@/lib/server/google-calendar-freebusy";

const mocks = vi.hoisted(() => ({
  freebusyQuery: vi.fn(),
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
  createGoogleCalendarClient: mocks.createGoogleCalendarClient,
}));
vi.mock("@/lib/server/google-oauth", () => ({ refreshAccessToken: mocks.refreshAccessToken }));

describe("Google Calendar FreeBusy failure classification", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses the canonical timeout and degrades to a controlled provider error when FreeBusy stalls", async () => {
    vi.useFakeTimers();
    mocks.refreshAccessToken.mockResolvedValue("access-token");
    mocks.createGoogleCalendarClient.mockReturnValue({ freebusy: { query: mocks.freebusyQuery } });
    mocks.freebusyQuery.mockImplementation((_request, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }));
    const { queryPrimaryCalendarFreeBusy } = await import("@/lib/server/google-calendar-freebusy");

    const result = queryPrimaryCalendarFreeBusy("2026-08-05T12:00:00.000Z", "2026-08-05T12:30:00.000Z");
    const assertion = expect(result).rejects.toMatchObject({
      name: "FreeBusyError",
       code: "FREEBUSY_TIMEOUT",
    } satisfies Partial<InstanceType<typeof FreeBusyError>>);
    await vi.advanceTimersByTimeAsync(3_500);

    await assertion;
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("refresh-token", 3_500);
    expect(mocks.createGoogleCalendarClient).toHaveBeenCalledWith("access-token", 3_500);
    expect(mocks.freebusyQuery).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 3_500 }),
    );
  });

  it.each([
    ["invalid_grant", "FREEBUSY_AUTHENTICATION"],
    ["temporary upstream outage", "FREEBUSY_TRANSIENT"],
  ])("classifies %s distinctly", async (message, code) => {
    mocks.refreshAccessToken.mockRejectedValue(new Error(message));
    const { queryPrimaryCalendarFreeBusy } = await import("@/lib/server/google-calendar-freebusy");

    await expect(queryPrimaryCalendarFreeBusy("2026-08-05T12:00:00.000Z", "2026-08-05T12:30:00.000Z"))
      .rejects.toMatchObject({ code });
  });
});
