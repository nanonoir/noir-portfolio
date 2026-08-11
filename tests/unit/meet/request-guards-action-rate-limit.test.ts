import { describe, expect, it } from "vitest";

import { isActionRateLimitAllowed } from "@/lib/meet/request-guards";

describe("public action request guard", () => {
  it("bounds a Vercel-forwarded caller per meeting and action without using a token", async () => {
    const request = new Request("http://localhost/api/meetings/meet-rate-limit/confirm", {
      headers: { "x-vercel-forwarded-for": "198.51.100.42, 10.0.0.1" },
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(isActionRateLimitAllowed(request, "meet-rate-limit", "confirm")).resolves.toBe(true);
    }
    await expect(isActionRateLimitAllowed(request, "meet-rate-limit", "confirm")).resolves.toBe(false);
    await expect(isActionRateLimitAllowed(request, "another-meeting", "confirm")).resolves.toBe(true);
  });
});
