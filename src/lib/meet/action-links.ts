import "server-only";

import { getEnv, isFirebaseConfigured } from "@/lib/server/env";
import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";

/**
 * Phase 4 action URL builder (PRD §7: "Links use APP_BASE_URL").
 *
 * Returns the canonical absolute URL for an action confirmation page. The raw
 * token travels in the URL fragment (`#t=...`) so it never reaches server logs
 * or referrers as a query parameter; client JS on the GET page reads the
 * fragment and POSTs it. The POST endpoint accepts the token in the JSON body.
 *
 * Server-only: only email-rendering and action-issuance paths call this. No
 * client bundle imports it.
 */

const ACTION_PATHS: Record<ActionTokenAction, string> = {
  [ACTION_TOKEN_ACTIONS.CONFIRM]: "confirm",
  [ACTION_TOKEN_ACTIONS.PROPOSE]: "propose",
  [ACTION_TOKEN_ACTIONS.DECLINE]: "decline",
  [ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL]: "accept-proposal",
};

export function getActionBasePath(meetingId: string, action: ActionTokenAction): string {
  return `/meetings/${encodeURIComponent(meetingId)}/${ACTION_PATHS[action]}`;
}

/**
 * Build the user-facing action link. The raw token is in the URL fragment so
 * the GET page can read it client-side and POST it without leaking to logs.
 */
export function buildActionLink(params: {
  meetingId: string;
  action: ActionTokenAction;
  rawToken: string;
}): string {
  const { meetingId, action, rawToken } = params;
  const configuredBase = getEnv("APP_BASE_URL");
  // APP_BASE_URL is required in Firebase-backed Preview/Production. Local
  // no-env mock mode uses localhost only so Phase 6 contract tests can render
  // intended action links without fabricating a production URL.
  if (!configuredBase && isFirebaseConfigured()) {
    throw new Error("Missing required server environment variable: APP_BASE_URL");
  }
  const base = (configuredBase ?? "http://localhost:3000").replace(/\/+$/, "");
  const path = getActionBasePath(meetingId, action);
  return `${base}${path}#t=${encodeURIComponent(rawToken)}`;
}
