import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { FirestoreActionTokenRepository } from "@/lib/meet/firestore-action-token-repository";
import { ACTION_TOKEN_PROCESSING_LEASE_MS } from "@/lib/meet/action-tokens";
import {
  FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
  GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS,
} from "@/lib/meet/deadlines";
import { consumeFirestoreFixedWindow } from "@/lib/meet/firestore-rate-limit";
import { getFirestore } from "@/lib/server/firestore";
import { clearFirestore } from "../../helpers/firebase-emulator";

const meetingId = "integration-meeting-001";
const tokenHash = createHash("sha256").update("integration-token").digest("hex");

describe("Firestore emulator token and rate-limit transactions", () => {
  beforeEach(async () => clearFirestore());
  afterEach(async () => clearFirestore());

  function tokenRecord(id: string) {
    return {
      action: "confirm" as const,
      actor: "owner" as const,
      createdAt: "2026-08-03T12:00:00.000Z",
      expiresAt: "2026-08-10T12:00:00.000Z",
      id,
      meetingId,
      processingOwnerNonce: null,
      processingStartedAt: null,
      proposalVersion: "1",
      result: null,
      tokenHash,
      usedAt: null,
    };
  }

  function claim(usedAt: string, processingOwnerNonce: string) {
    return { usedAt, processingStartedAt: usedAt, processingOwnerNonce };
  }

  it("derives the recoverable action lease from the bounded provider and transaction policy", () => {
    expect(ACTION_TOKEN_PROCESSING_LEASE_MS).toBe(
      GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS + (2 * FIRESTORE_RATE_LIMIT_TIMEOUT_MS) + 500,
    );
  });

  it("claims an action token once under concurrent consumption", async () => {
    const repository = new FirestoreActionTokenRepository();
    await repository.create(tokenRecord("integration-token-001"));
    const [first, second] = await Promise.all([
      repository.markUsed(meetingId, "integration-token-001", claim("2026-08-03T12:01:00.000Z", "owner-a")),
      repository.markUsed(meetingId, "integration-token-001", claim("2026-08-03T12:01:00.000Z", "owner-b")),
    ]);
    expect([first?.claimed, second?.claimed].filter(Boolean)).toHaveLength(1);
    expect(await repository.findByTokenHash(meetingId, tokenHash)).toMatchObject({ usedAt: "2026-08-03T12:01:00.000Z" });
  });

  it("atomically reclaims a stale processing lease, including legacy processing records", async () => {
    const repository = new FirestoreActionTokenRepository();
    await repository.create({
      ...tokenRecord("integration-token-stale"),
      processingOwnerNonce: "timed-out-owner",
      processingStartedAt: "2026-08-03T12:00:00.000Z",
      result: { status: "processing" },
      usedAt: "2026-08-03T12:00:00.000Z",
    });

    const reclaimedAt = new Date(new Date("2026-08-03T12:00:00.000Z").getTime() + ACTION_TOKEN_PROCESSING_LEASE_MS).toISOString();
    await expect(repository.markUsed(meetingId, "integration-token-stale", claim(reclaimedAt, "reclaimer")))
      .resolves.toMatchObject({ claimed: true, record: { processingOwnerNonce: "reclaimer", usedAt: reclaimedAt } });

    await getFirestore().collection("meetings").doc(meetingId).collection("actionTokens").doc("integration-token-legacy").set({
      ...tokenRecord("integration-token-legacy"),
      result: { status: "processing" },
      usedAt: "2026-08-03T12:00:00.000Z",
    });
    await expect(repository.markUsed(meetingId, "integration-token-legacy", claim("2026-08-03T12:00:01.000Z", "legacy-reclaimer")))
      .resolves.toMatchObject({ claimed: true, record: { processingOwnerNonce: "legacy-reclaimer" } });
  });

  it("keeps a processing lease fresh until its canonical recovery boundary", async () => {
    const repository = new FirestoreActionTokenRepository();
    const startedAt = "2026-08-03T12:00:00.000Z";
    await repository.create({
      ...tokenRecord("integration-token-fresh"),
      processingOwnerNonce: "active-owner",
      processingStartedAt: startedAt,
      result: { status: "processing" },
      usedAt: startedAt,
    });

    const beforeRecovery = new Date(new Date(startedAt).getTime() + ACTION_TOKEN_PROCESSING_LEASE_MS - 1).toISOString();
    await expect(repository.markUsed(meetingId, "integration-token-fresh", claim(beforeRecovery, "contender")))
      .resolves.toMatchObject({ claimed: false, record: { processingOwnerNonce: "active-owner" } });
  });

  it("does not let a non-owner complete or release a processing lease", async () => {
    const repository = new FirestoreActionTokenRepository();
    await repository.create(tokenRecord("integration-token-ownership"));
    const ownerClaim = claim("2026-08-03T12:01:00.000Z", "owner-a");
    await repository.markUsed(meetingId, "integration-token-ownership", ownerClaim);
    const intruderClaim = { ...ownerClaim, processingOwnerNonce: "owner-b" };

    await expect(repository.completeUse(meetingId, "integration-token-ownership", intruderClaim, { status: "ok" })).resolves.toBeNull();
    await repository.releaseUse(meetingId, "integration-token-ownership", intruderClaim);
    expect(await repository.findByTokenHash(meetingId, tokenHash)).toMatchObject({
      processingOwnerNonce: "owner-a",
      result: { status: "processing" },
      usedAt: ownerClaim.usedAt,
    });
  });

  it("uses hashed identities and enforces a fixed window", async () => {
    expect(await consumeFirestoreFixedWindow("visitor@example.com", 2, 60_000)).toBe(true);
    expect(await consumeFirestoreFixedWindow("visitor@example.com", 2, 60_000)).toBe(true);
    expect(await consumeFirestoreFixedWindow("visitor@example.com", 2, 60_000)).toBe(false);
    const docs = await getFirestore().collection("rateLimits").get();
    expect(docs.docs[0]?.id).toMatch(/^[a-f0-9]{64}$/);
    expect(docs.docs[0]?.data()).toMatchObject({ count: 2 });
  });
});
