import "server-only";

import { ACTION_TOKEN_PROCESSING_LEASE_MS, type ActionTokenRecord } from "./action-tokens";

/** Persistence port; only token hashes cross this boundary. */

export interface ActionTokenRepository {
  create(record: ActionTokenRecord): Promise<ActionTokenRecord>;
  findByTokenHash(meetingId: string, tokenHash: string): Promise<ActionTokenRecord | null>;
  findByMeetingId(meetingId: string): Promise<ActionTokenRecord[]>;
  markUsed(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<ActionTokenUseClaim | null>;
  completeUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim, result: unknown): Promise<ActionTokenRecord | null>;
  releaseUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<void>;
}

export interface ActionTokenProcessingClaim {
  usedAt: string;
  processingStartedAt: string;
  processingOwnerNonce: string;
}

export interface ActionTokenUseClaim {
  claimed: boolean;
  record: ActionTokenRecord;
}

export class MockActionTokenRepository implements ActionTokenRepository {
  private readonly tokensById = new Map<string, ActionTokenRecord>();
  private readonly tokensByHash = new Map<string, ActionTokenRecord>();

  async create(record: ActionTokenRecord): Promise<ActionTokenRecord> {
    this.tokensById.set(record.id, record);
    this.tokensByHash.set(record.tokenHash, record);
    return record;
  }

  async findByTokenHash(meetingId: string, tokenHash: string): Promise<ActionTokenRecord | null> {
    const record = this.tokensByHash.get(tokenHash);
    return record?.meetingId === meetingId ? record : null;
  }

  async findByMeetingId(meetingId: string): Promise<ActionTokenRecord[]> {
    return Array.from(this.tokensById.values()).filter((token) => token.meetingId === meetingId);
  }

  async markUsed(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<ActionTokenUseClaim | null> {
    const current = this.tokensById.get(tokenId);
    if (!current || current.meetingId !== meetingId) return null;
    const canReclaim = current.usedAt !== null
      && isProcessingResult(current.result)
      && isProcessingLeaseStale(current.processingStartedAt, claim.processingStartedAt);
    if (current.usedAt !== null && !canReclaim) return { claimed: false, record: current };
    const updated: ActionTokenRecord = {
      ...current,
      usedAt: claim.usedAt,
      result: { status: "processing" },
      processingStartedAt: claim.processingStartedAt,
      processingOwnerNonce: claim.processingOwnerNonce,
    };
    this.tokensById.set(tokenId, updated);
    this.tokensByHash.set(updated.tokenHash, updated);
    return { claimed: true, record: updated };
  }

  async completeUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim, result: unknown): Promise<ActionTokenRecord | null> {
    const current = this.tokensById.get(tokenId);
    if (!current || !matchesClaim(current, meetingId, claim)) return null;
    const updated: ActionTokenRecord = { ...current, result, processingStartedAt: null, processingOwnerNonce: null };
    this.tokensById.set(tokenId, updated);
    this.tokensByHash.set(updated.tokenHash, updated);
    return updated;
  }

  async releaseUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<void> {
    const current = this.tokensById.get(tokenId);
    if (!current || !matchesClaim(current, meetingId, claim)) return;
    const updated: ActionTokenRecord = { ...current, usedAt: null, result: null, processingStartedAt: null, processingOwnerNonce: null };
    this.tokensById.set(tokenId, updated);
    this.tokensByHash.set(updated.tokenHash, updated);
  }
}

function matchesClaim(record: ActionTokenRecord, meetingId: string, claim: ActionTokenProcessingClaim) {
  return record.meetingId === meetingId
    && record.usedAt === claim.usedAt
    && record.processingOwnerNonce === claim.processingOwnerNonce;
}

function isProcessingResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && "status" in result && result.status === "processing";
}

function isProcessingLeaseStale(processingStartedAt: string | null, now: string): boolean {
  if (!processingStartedAt) return true;
  const startedAtMs = new Date(processingStartedAt).getTime();
  const nowMs = new Date(now).getTime();
  return Number.isNaN(startedAtMs) || Number.isNaN(nowMs) || nowMs - startedAtMs >= ACTION_TOKEN_PROCESSING_LEASE_MS;
}
