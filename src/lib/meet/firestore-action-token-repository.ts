import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { ACTION_TOKEN_PROCESSING_LEASE_MS, type ActionTokenRecord } from "./action-tokens";
import type { ActionTokenProcessingClaim, ActionTokenRepository, ActionTokenUseClaim } from "./action-token-repository";
import { getFirestore } from "@/lib/server/firestore";
import { meetLogger, normalizeErrorCause } from "./logger";

function rethrowForEmulatorTests(error: unknown): never | void {
  if (process.env.NODE_ENV === "test" && process.env.FIRESTORE_EMULATOR_HOST) {
    throw error;
  }
}

/**
 * Firestore-backed `ActionTokenRepository` (PRD §6.1, §7).
 *
 * Token records live under `meetings/{meetingId}/actionTokens/{tokenId}`. The
 * collection-group lookup by `tokenHash` is the only path that does NOT know
 * `meetingId` ahead of time (route handlers always know it; collection-group is
 * a defensive fallback for any internal caller). Server-only: no client path
 * reaches this module.
 *
 * Firestore composite index required (firestore.indexes.json):
 *   collectionGroup: "actionTokens", queryScope: COLLECTION_GROUP
 *   fields: [{ tokenHash, ASCENDING }, { id, ASCENDING }]
 * Without this index, collectionGroup queries will throw. Errors are caught
 * here and returned as `null` so the ActionService maps them to
 * LINK_NOT_ACTIVE or BOOKING_TEMPORARILY_UNAVAILABLE instead of propagating
 * an unhandled exception to the route handler.
 */

type StoredTokenDoc = Omit<ActionTokenRecord, "createdAt" | "expiresAt" | "usedAt" | "processingStartedAt"> & {
  createdAt: Timestamp | string;
  expiresAt: Timestamp | string;
  usedAt: Timestamp | string | null;
  processingStartedAt?: Timestamp | string | null;
};

function toStored(record: ActionTokenRecord): Record<string, unknown> {
  return {
    id: record.id,
    meetingId: record.meetingId,
    tokenHash: record.tokenHash,
    actor: record.actor,
    action: record.action,
    proposalVersion: record.proposalVersion,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    result: record.result ?? null,
    processingStartedAt: record.processingStartedAt,
    processingOwnerNonce: record.processingOwnerNonce,
    createdAt: record.createdAt,
  };
}

function fromStored(data: StoredTokenDoc): ActionTokenRecord {
  return {
    id: data.id,
    meetingId: data.meetingId,
    tokenHash: data.tokenHash,
    actor: data.actor,
    action: data.action,
    proposalVersion: data.proposalVersion,
    expiresAt: timestampToISO(data.expiresAt),
    usedAt: data.usedAt === null ? null : timestampToISO(data.usedAt),
    result: data.result ?? null,
    processingStartedAt: data.processingStartedAt == null ? null : timestampToISO(data.processingStartedAt),
    processingOwnerNonce: data.processingOwnerNonce ?? null,
    createdAt: timestampToISO(data.createdAt),
  };
}

function timestampToISO(value: Timestamp | string): string {
  if (typeof value === "string") return value;
  try {
    return value.toDate().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export class FirestoreActionTokenRepository implements ActionTokenRepository {
  async create(record: ActionTokenRecord): Promise<ActionTokenRecord> {
    const db = getFirestore();
    const ref = db
      .collection("meetings")
      .doc(record.meetingId)
      .collection("actionTokens")
      .doc(record.id);
    await ref.set({ ...toStored(record), createdAt: FieldValue.serverTimestamp() });
    return record;
  }

  async findByTokenHash(meetingId: string, tokenHash: string): Promise<ActionTokenRecord | null> {
    try {
      const db = getFirestore();
      const snap = await db
        .collection("meetings")
        .doc(meetingId)
        .collection("actionTokens")
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return fromStored(snap.docs[0]!.data() as StoredTokenDoc);
    } catch (error) {
      // Firestore index/permission/network errors must not propagate as HTTP
      // 500. Log a bounded cause and return null so ActionService maps this to
      // LINK_NOT_ACTIVE (or BOOKING_TEMPORARILY_UNAVAILABLE at the route layer).
      meetLogger.error("action_token.lookup_failed", {
        cause: normalizeErrorCause(error),
      });
      rethrowForEmulatorTests(error);
      return null;
    }
  }

  async findByMeetingId(meetingId: string): Promise<ActionTokenRecord[]> {
    const db = getFirestore();
    const snap = await db
      .collection("meetings")
      .doc(meetingId)
      .collection("actionTokens")
      .get();
    return snap.docs.map((doc) => fromStored(doc.data() as StoredTokenDoc));
  }

  async markUsed(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<ActionTokenUseClaim | null> {
    try {
      const db = getFirestore();
      const docRef = db.collection("meetings").doc(meetingId).collection("actionTokens").doc(tokenId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) return null;
        const current = fromStored(snap.data() as StoredTokenDoc);
        const canReclaim = current.usedAt !== null
          && isProcessingResult(current.result)
          && isProcessingLeaseStale(current.processingStartedAt, claim.processingStartedAt);
        if (current.usedAt !== null && !canReclaim) return { claimed: false, record: current };
        const result = { status: "processing" };
        tx.update(docRef, {
          usedAt: claim.usedAt,
          result,
          processingStartedAt: claim.processingStartedAt,
          processingOwnerNonce: claim.processingOwnerNonce,
          usedAtServer: FieldValue.serverTimestamp(),
        });
        return { claimed: true, record: { ...current, usedAt: claim.usedAt, result, processingStartedAt: claim.processingStartedAt, processingOwnerNonce: claim.processingOwnerNonce } };
      });
    } catch (error) {
      // Firestore errors in markUsed must not propagate. Log and return null;
      // the action service will surface this as BOOKING_TEMPORARILY_UNAVAILABLE
      // at the route layer, keeping the response stable.
      meetLogger.error("action_token.mark_used_failed", {
        cause: normalizeErrorCause(error),
      });
      rethrowForEmulatorTests(error);
      return null;
    }
  }

  async completeUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim, result: unknown): Promise<ActionTokenRecord | null> {
    try {
      const db = getFirestore();
      const docRef = db.collection("meetings").doc(meetingId).collection("actionTokens").doc(tokenId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) return null;
        const current = fromStored(snap.data() as StoredTokenDoc);
        if (!matchesClaim(current, meetingId, claim)) return null;
        tx.update(docRef, { result, processingStartedAt: null, processingOwnerNonce: null });
        return { ...current, result, processingStartedAt: null, processingOwnerNonce: null };
      });
    } catch (error) {
      meetLogger.error("action_token.complete_use_failed", { cause: normalizeErrorCause(error) });
      return null;
    }
  }

  async releaseUse(meetingId: string, tokenId: string, claim: ActionTokenProcessingClaim): Promise<void> {
    try {
      const db = getFirestore();
      const docRef = db.collection("meetings").doc(meetingId).collection("actionTokens").doc(tokenId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) return;
        const current = fromStored(snap.data() as StoredTokenDoc);
        if (!matchesClaim(current, meetingId, claim)) return;
        tx.update(docRef, { result: null, usedAt: null, processingStartedAt: null, processingOwnerNonce: null, usedAtServer: FieldValue.delete() });
      });
    } catch (error) {
      meetLogger.error("action_token.release_use_failed", { cause: normalizeErrorCause(error) });
    }
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
