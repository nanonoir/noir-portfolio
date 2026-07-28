import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";
import { ACTION_TOKEN_DEFAULT_TTL_MS } from "./deadlines";

export { ACTION_TOKEN_DEFAULT_TTL_MS, ACTION_TOKEN_PROCESSING_LEASE_MS } from "./deadlines";

/**
 * Phase 4 action token domain (PRD §7).
 *
 * Opaque, hashed, expiring tokens mediate every definitive meeting action.
 * Two actors own distinct token scopes:
 *  - `owner`  (Nahuel): `confirm`, `propose`, `decline`
 *  - `visitor`:          `accept_proposal`, `propose`, `decline`
 *
 * The raw token is returned to the caller only at issuance time so it can be
 * embedded in a server-rendered action link (Phase 6 email). Firestore stores
 * only `tokenHash` (SHA-256 hex); the raw token is never persisted.
 *
 * Server-only: tokens are minted, validated, and consumed exclusively on the
 * server. Route handlers receive the raw token via the POST body and pass it
 * to the action service; the service hashes it before any storage lookup.
 */

export const ACTION_TOKEN_ACTORS = {
  OWNER: "owner",
  VISITOR: "visitor",
} as const;

export type ActionTokenActor = (typeof ACTION_TOKEN_ACTORS)[keyof typeof ACTION_TOKEN_ACTORS];

export { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";

/** Owner-only actions (Nahuel). */
export const OWNER_ACTIONS: ReadonlySet<ActionTokenAction> = new Set<ActionTokenAction>([
  ACTION_TOKEN_ACTIONS.CONFIRM,
  ACTION_TOKEN_ACTIONS.PROPOSE,
  ACTION_TOKEN_ACTIONS.DECLINE,
]);

/** Visitor-only actions. */
export const VISITOR_ACTIONS: ReadonlySet<ActionTokenAction> = new Set<ActionTokenAction>([
  ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL,
  ACTION_TOKEN_ACTIONS.PROPOSE,
  ACTION_TOKEN_ACTIONS.DECLINE,
]);

export function isActionAllowedForActor(actor: ActionTokenActor, action: ActionTokenAction): boolean {
  return actor === ACTION_TOKEN_ACTORS.OWNER
    ? OWNER_ACTIONS.has(action)
    : VISITOR_ACTIONS.has(action);
}

/**
 * Default TTL per action. Owner action tokens for a `requested` meeting live
 * long enough for Nahuel to act on a new lead. Visitor tokens that bind to a
 * proposal expire at the proposed slot start per PRD §7
 * ("proposal links expire at the proposed slot start"), computed at issuance.
 */
/**
 * Compute an explicit `expiresAt` for an issued token.
 *
 *  - `accept_proposal` anchors on the proposed slot start (PRD §7).
 *  - Other actions use the fixed default TTL from `ACTION_TOKEN_DEFAULT_TTL_MS`.
 */
export function computeTokenExpiry(
  action: ActionTokenAction,
  issuedAt: Date,
  proposedSlotStartISO: string | null,
): string {
  if (action === ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL && proposedSlotStartISO) {
    return proposedSlotStartISO;
  }
  const ttl = ACTION_TOKEN_DEFAULT_TTL_MS[action] ?? 24 * 60 * 60 * 1000;
  return new Date(issuedAt.getTime() + ttl).toISOString();
}

export interface ActionTokenRecord {
  id: string;
  meetingId: string;
  tokenHash: string;
  actor: ActionTokenActor;
  action: ActionTokenAction;
  proposalVersion: string;
  expiresAt: string;
  usedAt: string | null;
  result: unknown | null;
  /** Durable ownership of an in-flight action execution. */
  processingStartedAt: string | null;
  processingOwnerNonce: string | null;
  createdAt: string;
}

export interface IssuedActionToken {
  /** Raw opaque token. NEVER persist, log, or expose outside intended links. */
  token: string;
  record: ActionTokenRecord;
}

/** Generate a 256-bit opaque token, base64url-encoded (43 chars). */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Compute the SHA-256 hex hash used as the durable Firestore lookup key. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isTokenExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return true;
  return now.getTime() >= expiry;
}
