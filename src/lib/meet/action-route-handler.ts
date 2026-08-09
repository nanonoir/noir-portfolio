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

/** Creates action routes with side-effect-free GET and consuming POST handlers. */

export const dynamic = "force-dynamic";

function readTokenFromQuery(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
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
  try {
    const form = new URLSearchParams(text);
    const rawProposedSlot = form.get("proposedSlot");

    let proposedSlot: unknown;
    let invalidProposedSlot = false;

    if (rawProposedSlot !== null && rawProposedSlot.trim() !== "") {
      try {
        proposedSlot = JSON.parse(rawProposedSlot) as unknown;
      } catch {
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

        if (!rawToken) {
          return new Response(
            renderNeutralShell({ action, meetingId: id }),
            { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

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
