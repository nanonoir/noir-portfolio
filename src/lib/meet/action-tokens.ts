import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";
import { ACTION_TOKEN_DEFAULT_TTL_MS } from "./deadlines";

export { ACTION_TOKEN_DEFAULT_TTL_MS, ACTION_TOKEN_PROCESSING_LEASE_MS } from "./deadlines";

/** Opaque expiring tokens are hashed before persistence and remain server-only. */

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

/** Computes expiry at the proposed slot start or from the default action TTL. */
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
