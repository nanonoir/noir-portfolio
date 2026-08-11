import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn() }));

vi.mock("@/lib/server/env", () => ({ isFirebaseConfigured: vi.fn(() => true) }));
vi.mock("@/lib/meet/firestore-rate-limit", () => ({
  consumeFirestoreFixedWindow: mocks.consume,
}));

describe("action rate-limit Firestore timeout fallback", () => {
  it("uses the process-local fixed window when Firestore times out", async () => {
    mocks.consume.mockRejectedValueOnce(new Error("Operation timed out"));
    const { isActionRateLimitAllowed } = await import("@/lib/meet/request-guards");
    const request = new Request("http://localhost/api/meetings/meet-timeout/confirm", {
      headers: { "x-vercel-forwarded-for": "198.51.100.99" },
    });

    await expect(isActionRateLimitAllowed(request, "meet-timeout", "confirm")).resolves.toBe(true);
    expect(mocks.consume).toHaveBeenCalledOnce();
  });
});
