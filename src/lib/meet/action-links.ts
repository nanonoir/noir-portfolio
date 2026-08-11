import "server-only";

import { getEnv, isFirebaseConfigured } from "@/lib/server/env";
import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";

/** Server-only action links keep raw tokens in fragments, not query strings. */

const ACTION_PATHS: Record<ActionTokenAction, string> = {
  [ACTION_TOKEN_ACTIONS.CONFIRM]: "confirm",
  [ACTION_TOKEN_ACTIONS.PROPOSE]: "propose",
  [ACTION_TOKEN_ACTIONS.DECLINE]: "decline",
  [ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL]: "accept-proposal",
};

export function getActionBasePath(meetingId: string, action: ActionTokenAction): string {
  return `/meetings/${encodeURIComponent(meetingId)}/${ACTION_PATHS[action]}`;
}

/** Builds a user-facing link with the raw token confined to the URL fragment. */
export function buildActionLink(params: {
  meetingId: string;
  action: ActionTokenAction;
  rawToken: string;
}): string {
  const { meetingId, action, rawToken } = params;
  const configuredBase = getEnv("APP_BASE_URL");
  // Require an explicit base URL for Firebase-backed environments.
  if (!configuredBase && isFirebaseConfigured()) {
    throw new Error("Missing required server environment variable: APP_BASE_URL");
  }
  const base = (configuredBase ?? "http://localhost:3000").replace(/\/+$/, "");
  const path = getActionBasePath(meetingId, action);
  return `${base}${path}#t=${encodeURIComponent(rawToken)}`;
}
