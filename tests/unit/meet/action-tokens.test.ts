import { describe, expect, it } from "vitest";
import { ACTION_TOKEN_ACTIONS, ACTION_TOKEN_ACTORS, OWNER_ACTIONS, VISITOR_ACTIONS, computeTokenExpiry, generateRawToken, hashToken, isActionAllowedForActor, isTokenExpired } from "@/lib/meet/action-tokens";

describe("action tokens", () => {
  it("enforces distinct actor scopes", () => {
    expect(OWNER_ACTIONS).toEqual(new Set(["confirm", "propose", "decline"]));
    expect(VISITOR_ACTIONS).toEqual(new Set(["accept_proposal", "propose", "decline"]));
    expect(isActionAllowedForActor(ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL)).toBe(false);
    expect(isActionAllowedForActor(ACTION_TOKEN_ACTORS.VISITOR, ACTION_TOKEN_ACTIONS.CONFIRM)).toBe(false);
  });
  it("creates stable hash and expiry boundaries", () => {
    const issuedAt = new Date("2026-08-03T12:00:00.000Z");
    expect(computeTokenExpiry(ACTION_TOKEN_ACTIONS.CONFIRM, issuedAt, null)).toBe("2026-08-10T12:00:00.000Z");
    expect(computeTokenExpiry(ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL, issuedAt, "2026-08-05T10:00:00.000Z")).toBe("2026-08-05T10:00:00.000Z");
    const token = generateRawToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(isTokenExpired("invalid", issuedAt)).toBe(true);
    expect(isTokenExpired(issuedAt.toISOString(), issuedAt)).toBe(true);
  });
});
