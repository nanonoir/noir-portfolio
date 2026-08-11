import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("meet logger", () => {
  it("retains the idempotency key while redacting sensitive correlation fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { meetLogger } = await import("@/lib/meet/logger");

    meetLogger.info("booking.start", {
      idempotencyKey: "idempotency-123",
      bookingId: "meeting-123",
      code: "EMAIL_PROVIDER_ERROR",
      rawActionToken: "raw-action-token",
      tokenHash: "token-hash",
      oauthCode: "oauth-code",
      refreshToken: "refresh-token",
      credentials: "credentials",
      email: "person@example.com",
      phone: "+54 11 1234 5678",
      message: "private message",
      providerDetails: "provider response payload",
      provider: "email",
      rawIp: "127.0.0.1",
      deliveryState: "failed",
    });

    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      event: "booking.start",
      operation: "booking.start",
      idempotencyKey: "idempotency-123",
      bookingId: "meeting-123",
      code: "EMAIL_PROVIDER_ERROR",
      errorCode: "EMAIL_PROVIDER_ERROR",
      meetingId: "meeting-123",
      provider: "email",
      deliveryState: "failed",
    });
  });
});
