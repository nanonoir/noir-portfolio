import { afterEach, describe, expect, it, vi } from "vitest";

import { createBookingRecord } from "@/lib/meet/booking-model";
import { createBookingRequest } from "../../helpers/booking-factory";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/server/resend", () => ({
  getResendClient: () => ({ emails: { send: mocks.send } }),
  isResendClientConfigured: mocks.configured,
}));
vi.mock("@/lib/server/env", () => ({
  getEnv: vi.fn((key: string) => key === "CONTACT_FROM_EMAIL" ? "from@example.test" : undefined),
}));

describe("Resend email provider failure classes", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("classifies missing Resend configuration explicitly", async () => {
    mocks.configured.mockReturnValue(false);
    const { ResendEmailProvider } = await import("@/lib/server/resend-email-provider");
    const result = await new ResendEmailProvider().send("MEETING_RECEIVED", {
      booking: createBookingRecord(createBookingRequest(), { id: "meet-1" }),
      payload: {},
      recipient: "visitor@example.test",
    });

    expect(result).toEqual({ error: "EMAIL_PROVIDER_CONFIGURATION", success: false });
  });

  it("classifies bounded Resend stalls as timeouts", async () => {
    vi.useFakeTimers();
    mocks.configured.mockReturnValue(true);
    mocks.send.mockImplementation(() => new Promise(() => undefined));
    const { ResendEmailProvider } = await import("@/lib/server/resend-email-provider");
    const result = new ResendEmailProvider().send("MEETING_RECEIVED", {
      booking: createBookingRecord(createBookingRequest(), { id: "meet-1" }),
      payload: {},
      recipient: "visitor@example.test",
    });
    await vi.advanceTimersByTimeAsync(3_500);

    await expect(result).resolves.toEqual({ error: "EMAIL_PROVIDER_TIMEOUT", success: false });
  });
});
