import { NextResponse } from "next/server";

import { actionService } from "@/lib/meet/composition";
import {
  buildConsumedResponse,
  buildPreviewResponse,
  renderNeutralShell,
  renderActionPageRedirect,
  renderResultPage,
  type ActionErrorResponse,
} from "@/lib/meet/action-routes-helpers";
import type { ActionTokenAction } from "./action-contract";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";
import {
  REQUEST_GUARD_RESULTS,
  isActionRateLimitAllowed,
  readBoundedTextRequest,
} from "@/lib/meet/request-guards";
import { parseProposedSlot } from "@/lib/meet/schemas";

/**
 * Phase 4 action route factory (PRD §13.4).
 *
 * Each action route (`confirm`, `propose`, `decline`, `accept-proposal`) is a
 * thin handler that:
 *
 *  - GET: preview the raw token (no side effects), render a minimal
 *    confirmation page with `noindex,nofollow` (PRD §7).
 *  - POST: consume the token + payload via the shared `ActionService`,
 *    returning the appropriate JSON response or stable error code.
 *
 * Definitive actions always use POST (PRD §5.2). GET routes MUST NOT mutate
 * state — they only validate the token and render the confirmation form.
 *
 * Errors map to the stable codes from PRD §12:
 *  - 410 `LINK_NOT_ACTIVE`        for expired/used/wrong-actor/wrong-action
 *  - 409 `SLOT_UNAVAILABLE`        for confirm/accept-proposal slot conflicts
 *  - 409 `IDEMPOTENCY_CONFLICT`    reserved (issued by booking service, not here)
 *  - 400 `INVALID_PAYLOAD`         for malformed POST bodies (e.g. missing
 *                                  proposedSlot on `propose`)
 *  - 503 `BOOKING_TEMPORARILY_UNAVAILABLE` for unexpected failures
 */

export const dynamic = "force-dynamic";

function readTokenFromQuery(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  // Fallback for callers that pass the token in the fragment via `#t=...`;
  // browsers never send the fragment to the server, so the GET page reads it
  // client-side and re-POSTs it. For direct preview (e.g. internal callers
  // that include the token in the query), we still support `?token=`.
  return null;
}

interface ActionPostBody {
  invalidPayload?: boolean;
  proposedSlot?: unknown;
  reason?: string;
  token?: string;
  tooLarge: boolean;
  /** Set when the form-encoded `proposedSlot` field is present but not valid JSON. */
  invalidProposedSlot?: boolean;
}

async function readPostBody(request: Request): Promise<ActionPostBody> {
  const bounded = await readBoundedTextRequest(request);
  if (bounded.result === REQUEST_GUARD_RESULTS.TOO_LARGE) return { tooLarge: true };
  if (bounded.result !== REQUEST_GUARD_RESULTS.ALLOWED) return { tooLarge: false, invalidPayload: true };
  const text = bounded.text ?? "";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(text) as { token?: string; proposedSlot?: unknown; reason?: string };
      if (typeof json !== "object" || json === null || Array.isArray(json)) {
        return { tooLarge: false, invalidPayload: true };
      }
      return {
        token: typeof json.token === "string" ? json.token : undefined,
        proposedSlot: json.proposedSlot,
        reason: typeof json.reason === "string" ? json.reason : undefined,
        tooLarge: false,
      };
    } catch {
      return { tooLarge: false, invalidPayload: true };
    }
  }
  // Form-encoded fallback for the minimal HTML confirmation page.
  // Supports `propose` actions that require a JSON-serialized `proposedSlot` field.
  try {
    const form = new URLSearchParams(text);
    const rawProposedSlot = form.get("proposedSlot");

    let proposedSlot: unknown;
    let invalidProposedSlot = false;

    if (rawProposedSlot !== null && rawProposedSlot.trim() !== "") {
      try {
        proposedSlot = JSON.parse(rawProposedSlot) as unknown;
      } catch {
        // Present but not parseable JSON — caller must reject with INVALID_PAYLOAD.
        invalidProposedSlot = true;
      }
    }

    return {
      token: form.get("token") ?? undefined,
      reason: form.get("reason") ?? undefined,
      proposedSlot,
      invalidProposedSlot: invalidProposedSlot || undefined,
      tooLarge: false,
    };
  } catch {
    return { tooLarge: false, invalidPayload: true };
  }
}

function errorToStatus(error: string): number {
  if (error === MEETING_ERROR_CODES.LINK_NOT_ACTIVE) return 410;
  if (error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE) return 409;
  if (error === MEETING_ERROR_CODES.INVALID_PAYLOAD) return 400;
  if (error === MEETING_ERROR_CODES.INVALID_DATE || error === MEETING_ERROR_CODES.INVALID_TIMEZONE || error === MEETING_ERROR_CODES.DATE_OUT_OF_RANGE) return 400;
  return 503;
}

function errorToReason(error: string): ActionErrorResponse["reason"] | undefined {
  switch (error) {
    case MEETING_ERROR_CODES.LINK_NOT_ACTIVE: return "not_found";
    case MEETING_ERROR_CODES.SLOT_UNAVAILABLE: return "slot_unavailable";
    case MEETING_ERROR_CODES.INVALID_PAYLOAD: return "invalid_payload";
    default: return undefined;
  }
}

export interface ActionRouteHandler {
  GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response>;
  POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response>;
}

export function createActionRouteHandler(action: ActionTokenAction): ActionRouteHandler {
  return {
    async GET(request, context) {
      try {
        const { id } = await context.params;
        if (!(await isActionRateLimitAllowed(request, id, action))) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.RATE_LIMITED, reason: "rate_limit_exceeded" } satisfies ActionErrorResponse,
            { status: 429 },
          );
        }
        const rawToken = readTokenFromQuery(request);

        if (!rawToken && request.headers.get("accept")?.includes("text/html")) {
          return new Response(
            renderActionPageRedirect({ action, meetingId: id }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        // No query token: render the neutral shell. The client-side script will
        // extract the token from the URL fragment (#t=<token>) and submit it
        // via POST. This preserves fragment-based token confidentiality — the
        // raw token is never sent in the GET request body or query string.
        if (!rawToken) {
          return new Response(
            renderNeutralShell({ action, meetingId: id }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        // Query token present: attempt server-side preview (no side effects).
        // Return the result page regardless of outcome — never HTTP 500.
        const preview = await actionService.previewAction({ meetingId: id, rawToken, expectedAction: action });
        if (!preview.ok) {
          return new Response(
            renderResultPage({ action, meetingId: id, preview: null, error: { success: false, error: preview.error, reason: errorToReason(preview.error) } }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        const previewResponse = buildPreviewResponse(preview.record, preview.meeting);
        return new Response(
          renderResultPage({ action, meetingId: id, preview: previewResponse, error: null }),
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        );
      } catch (error) {
        // Top-level guard: any unexpected exception (e.g. Firestore index error,
        // transient network failure) becomes a stable 503 JSON response — never
        // an unhandled HTTP 500. The raw exception is never forwarded to the
        // client; only a bounded, normalized cause is logged.
        meetLogger.error("action_route.get_failed", {
          action,
          cause: normalizeErrorCause(error),
        });
        return NextResponse.json(
          { success: false, error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE } satisfies ActionErrorResponse,
          { status: 503 },
        );
      }
    },

    async POST(request, context) {
      try {
        const { id } = await context.params;
        if (!(await isActionRateLimitAllowed(request, id, action))) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.RATE_LIMITED, reason: "rate_limit_exceeded" } satisfies ActionErrorResponse,
            { status: 429 },
          );
        }
        const body = await readPostBody(request);
        if (body.tooLarge) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.INVALID_PAYLOAD, reason: "invalid_payload" } satisfies ActionErrorResponse,
            { status: 400 },
          );
        }
        if (body.invalidPayload) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.INVALID_PAYLOAD, reason: "invalid_payload" } satisfies ActionErrorResponse,
            { status: 400 },
          );
        }
        if (body.invalidProposedSlot) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.INVALID_PAYLOAD, reason: "invalid_payload" } satisfies ActionErrorResponse,
            { status: 400 },
          );
        }
        if (!body.token) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE, reason: "not_found" } satisfies ActionErrorResponse,
            { status: 410 },
          );
        }

        const parsedProposedSlot = action === "propose" ? parseProposedSlot(body.proposedSlot) : undefined;
        if (action === "propose" && !parsedProposedSlot) {
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.INVALID_PAYLOAD, reason: "invalid_payload" } satisfies ActionErrorResponse,
            { status: 400 },
          );
        }
        const proposedSlot = parsedProposedSlot ?? undefined;

        try {
          const result = await actionService.consumeAction({
            meetingId: id,
            rawToken: body.token,
            expectedAction: action,
            payload: {
              proposedSlot,
              reason: body.reason,
            },
          });

          if (result.status === "pending") {
            return NextResponse.json(
              { success: false, error: result.error ?? MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE } satisfies ActionErrorResponse,
              { status: 503 },
            );
          }

          if (result.status === "ok" || result.status === "replayed") {
            if (!result.meeting) {
              return NextResponse.json(
                { success: false, error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE } satisfies ActionErrorResponse,
                { status: 503 },
              );
            }
            const response = buildConsumedResponse({
              action,
              meeting: result.meeting,
              status: result.status,
              issuedTokens: (result.issuedTokens ?? []).map((issued) => ({ record: issued.record })),
              consumedTokenId: result.consumedTokenId,
            });
            return NextResponse.json(response, { status: result.status === "replayed" ? 200 : 200 });
          }

          if (result.status === "slot_unavailable") {
            return NextResponse.json(
              { success: false, error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, reason: "slot_unavailable" } satisfies ActionErrorResponse,
              { status: 409 },
            );
          }
          if (result.status === "invalid_transition") {
            return NextResponse.json(
              { success: false, error: result.error ?? MEETING_ERROR_CODES.LINK_NOT_ACTIVE, reason: "invalid_transition" } satisfies ActionErrorResponse,
              { status: 409 },
            );
          }
          // status === "rejected"
          const status = errorToStatus(result.error ?? MEETING_ERROR_CODES.LINK_NOT_ACTIVE);
          return NextResponse.json(
            { success: false, error: result.error ?? MEETING_ERROR_CODES.LINK_NOT_ACTIVE, reason: errorToReason(result.error ?? MEETING_ERROR_CODES.LINK_NOT_ACTIVE) } satisfies ActionErrorResponse,
            { status },
          );
        } catch (error) {
          meetLogger.error("action.route.unexpected_error", {
            action,
            meetingId: id,
            cause: normalizeErrorCause(error),
          });
          return NextResponse.json(
            { success: false, error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE } satisfies ActionErrorResponse,
            { status: 503 },
          );
        }
      } catch (error) {
        meetLogger.error("action_route.post_failed", {
          action,
          cause: normalizeErrorCause(error),
        });
        return NextResponse.json(
          { success: false, error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE } satisfies ActionErrorResponse,
          { status: 503 },
        );
      }
    },
  };
}
