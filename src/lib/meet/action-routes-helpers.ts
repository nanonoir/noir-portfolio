import "server-only";

import type { ActionTokenRecord } from "./action-tokens";
import type { ActionTokenAction } from "./action-contract";
import type { BookingRecord } from "./booking-model";
import type { ProviderDeliveryStatus } from "./dto";

/** Pure response shaping; GET previews do not consume tokens. */

export interface ActionPreviewResponse {
  success: true;
  action: ActionTokenAction;
  meetingId: string;
  status: BookingRecord["status"];
  actor: "owner" | "visitor";
  expiresAt: string;
  /** Hash-only token id, safe to expose. Never the raw token. */
  tokenId: string;
  proposalVersion: string;
}

export interface ActionConsumedResponse {
  success: true;
  status: "ok" | "replayed";
  action: ActionTokenAction;
  meetingId: string;
  meetingStatus: BookingRecord["status"];
  /** Sanitized aggregate delivery states; provider error details stay server-only. */
  emailDeliveryStatus: ProviderDeliveryStatus;
  calendarDeliveryStatus: ProviderDeliveryStatus;
  /** Hashes for the next actor; raw tokens remain reserved for email rendering. */
  issuedTokenIds: string[];
  /** Hash-only consumed token id. */
  consumedTokenId?: string;
}

export interface ActionErrorResponse {
  success: false;
  error: string;
  /** Optional human-safe context (no PII, no tokens). */
  reason?: "expired" | "wrong_action" | "wrong_actor" | "wrong_meeting" | "not_found" | "slot_unavailable" | "invalid_transition" | "invalid_payload" | "rate_limit_exceeded";
}

export function buildPreviewResponse(
  token: ActionTokenRecord,
  meeting: BookingRecord,
): ActionPreviewResponse {
  return {
    success: true,
    action: token.action,
    meetingId: token.meetingId,
    status: meeting.status,
    actor: token.actor,
    expiresAt: token.expiresAt,
    tokenId: token.id,
    proposalVersion: token.proposalVersion,
  };
}

export function buildConsumedResponse(params: {
  action: ActionTokenAction;
  meeting: BookingRecord;
  status: "ok" | "replayed";
  issuedTokens: { record: ActionTokenRecord }[];
  consumedTokenId?: string;
}): ActionConsumedResponse {
  return {
    success: true,
    status: params.status,
    action: params.action,
    meetingId: params.meeting.id,
    meetingStatus: params.meeting.status,
    emailDeliveryStatus: params.meeting.emailDelivery.status,
    calendarDeliveryStatus: params.meeting.calendarDelivery.status,
    issuedTokenIds: params.issuedTokens.map((token) => token.record.id),
    consumedTokenId: params.consumedTokenId,
  };
}

/** The fragment stays client-side until the user submits the POST form. */
export function renderNeutralShell(params: {
  action: ActionTokenAction;
  meetingId: string;
}): string {
  const { action, meetingId } = params;
  const actionLabel = action.replace(/_/g, " ");
  const title = `Confirm: ${actionLabel}`;
  const meta = `<meta name="robots" content="noindex,nofollow">`;
  const style = `body{font:14px system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}button{font:inherit;padding:.5rem 1rem}`;
  const formAction = `/api/meetings/${encodeURIComponent(meetingId)}/${actionToPath(action)}`;

  // The fragment token is copied client-side and is absent from server HTML.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${meta}<title>${title}</title><style>${style}</style></head><body>
<h1>${escapeHtml(actionLabel)}</h1>
<p>Validating your action link&hellip;</p>
<form id="action-form" method="POST" action="${escapeHtml(formAction)}">
  <input type="hidden" name="token" id="token-input" autocomplete="off">
  <button type="submit" id="action-btn">Confirm ${escapeHtml(actionLabel)}</button>
</form>
<script>
(function(){
  var hash = window.location.hash || "";
  var match = hash.match(/(?:^|#)t=([^&]+)/);
  if (match) {
    document.getElementById("token-input").value = decodeURIComponent(match[1]);
  } else {
    document.getElementById("action-btn").disabled = true;
    document.querySelector("p").textContent = "No action token found in this link. Please use the link from your email.";
  }
})();
</script>
</body></html>`;
}

export function renderResultPage(params: {
  action: ActionTokenAction;
  meetingId: string;
  preview: ActionPreviewResponse | null;
  error: ActionErrorResponse | null;
}): string {
  const { action, meetingId, preview, error } = params;
  const actionLabel = action.replace(/_/g, " ");
  const title = `Confirm: ${actionLabel}`;
  const meta = `<meta name="robots" content="noindex,nofollow">`;
  const style = `body{font:14px system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}button{font:inherit;padding:.5rem 1rem}`;

  if (error || !preview) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">${meta}<title>${title}</title><style>${style}</style></head><body><h1>Link not active</h1><p>This action link is invalid, expired, or already used.</p></body></html>`;
  }

  const formAction = `/api/meetings/${encodeURIComponent(meetingId)}/${actionToPath(action)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${meta}<title>${title}</title><style>${style}</style></head><body>
<h1>${escapeHtml(actionLabel)}</h1>
<p>Meeting <code>${escapeHtml(meetingId)}</code> — status <code>${escapeHtml(preview.status)}</code>.</p>
<p>Actor: <strong>${escapeHtml(preview.actor)}</strong>. Expires: <time>${escapeHtml(preview.expiresAt)}</time>.</p>
<form id="action-form" method="POST" action="${escapeHtml(formAction)}">
  <input type="hidden" name="token" id="token-input" autocomplete="off">
  <button type="submit">Confirm ${escapeHtml(actionLabel)}</button>
</form>
<script>
(function(){
  var hash = window.location.hash || "";
  var match = hash.match(/(?:^|#)t=([^&]+)/);
  if (match) { document.getElementById("token-input").value = decodeURIComponent(match[1]); }
})();
</script>
</body></html>`;
}

/** @deprecated Use `renderNeutralShell` or `renderResultPage`. */
export function renderConfirmationPageHtml(params: {
  action: ActionTokenAction;
  meetingId: string;
  preview: ActionPreviewResponse | null;
  error: ActionErrorResponse | null;
}): string {
  if (!params.preview && !params.error) {
    return renderNeutralShell({ action: params.action, meetingId: params.meetingId });
  }
  return renderResultPage(params);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function actionToPath(action: ActionTokenAction): string {
  switch (action) {
    case "confirm": return "confirm";
    case "propose": return "propose";
    case "decline": return "decline";
    case "accept_proposal": return "accept-proposal";
    default: return String(action);
  }
}

/** Redirects legacy action links while keeping their fragment client-side. */
export function renderActionPageRedirect(params: {
  action: ActionTokenAction;
  meetingId: string;
}): string {
  const path = `/meetings/${encodeURIComponent(params.meetingId)}/${actionToPath(params.action)}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Opening meeting action</title></head><body><script>var token=new URLSearchParams(window.location.hash.slice(1)).get("t");window.location.replace(${JSON.stringify(path)}+(token?"#t="+encodeURIComponent(token):""));</script></body></html>`;
}
