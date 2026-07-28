import "server-only";

import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";

/**
 * Server deadline and recovery policy.
 *
 * A Vercel function has a 10-second ceiling. Calendar work is limited to 3.5
 * seconds, reserving 1.5 seconds for Firestore and response handling. Webhook
 * claims therefore last 5 seconds. Action claims cover one Calendar operation,
 * two bounded Firestore transactions (claim/finalize), and a 500ms recovery
 * margin: 3,500 + (2 × 1,500) + 500 = 7,000ms.
 */
export const VERCEL_FUNCTION_TIMEOUT_MS = 10_000;
export const FIRESTORE_RATE_LIMIT_TIMEOUT_MS = 1_500;
export const GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS = 3_500;
export const GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS = GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS;
export const CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS =
  GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS + FIRESTORE_RATE_LIMIT_TIMEOUT_MS;
export const ACTION_TOKEN_PROCESSING_LEASE_MS =
  GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS + (2 * FIRESTORE_RATE_LIMIT_TIMEOUT_MS) + 500;

/** Fixed owner-action lifetime; proposal acceptance expires at its proposed slot. */
export const ACTION_TOKEN_DEFAULT_TTL_MS: Partial<Record<ActionTokenAction, number>> = {
  [ACTION_TOKEN_ACTIONS.CONFIRM]: 7 * 24 * 60 * 60 * 1000,
  [ACTION_TOKEN_ACTIONS.PROPOSE]: 7 * 24 * 60 * 60 * 1000,
  [ACTION_TOKEN_ACTIONS.DECLINE]: 7 * 24 * 60 * 60 * 1000,
  [ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL]: 0,
};

/**
 * Delivery state is persisted as pending/completed/failed. Processing is the
 * in-flight attempt; failed is retryable only through a compatible action
 * replay, while completed is terminal and never re-executes provider effects.
 */
export const DELIVERY_RETRY_STATES = {
  COMPLETED: "completed",
  FAILED: "failed",
  PENDING: "pending",
  PROCESSING: "processing",
  RETRYABLE: "retryable",
} as const;

export type DeliveryRetryState = (typeof DELIVERY_RETRY_STATES)[keyof typeof DELIVERY_RETRY_STATES];
