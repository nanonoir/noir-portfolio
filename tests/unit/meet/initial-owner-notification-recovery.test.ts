import { describe, expect, it, vi } from "vitest";

import type { IssuedActionToken } from "@/lib/meet/action-tokens";
import { sealInitialOwnerTokens, unsealInitialOwnerTokens } from "@/lib/meet/initial-owner-notification-recovery";

const issuedTokens: IssuedActionToken[] = [{
  token: "owner-token",
  record: {
    action: "confirm",
    actor: "owner",
    createdAt: "2026-08-03T12:00:00.000Z",
    expiresAt: "2026-08-10T12:00:00.000Z",
    id: "token-1",
    meetingId: "meet-1",
    processingOwnerNonce: null,
    processingStartedAt: null,
    proposalVersion: "v1",
    result: null,
    tokenHash: "hash",
    usedAt: null,
  },
}];

describe("initial owner notification recovery encryption", () => {
  it("uses an explicit production recovery key and fails closed when it is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
    vi.stubEnv("RECOVERY_ENCRYPTION_KEY", "");

    try {
      expect(() => sealInitialOwnerTokens(issuedTokens)).toThrow("RECOVERY_ENCRYPTION_KEY");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("round-trips with the runtime-generated test/emulator key without a committed fallback", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RECOVERY_TEST_KEY", "");

    try {
      const envelope = sealInitialOwnerTokens(issuedTokens);

      expect(envelope).not.toContain("owner-token");
      expect(unsealInitialOwnerTokens(envelope)).toEqual(issuedTokens);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
