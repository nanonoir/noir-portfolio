import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { buildAuthUrl, getGoogleOAuthAdminSecret } from "@/lib/server/google-oauth";

export const dynamic = "force-dynamic";

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

function readAdminSecret(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("admin");
  if (fromQuery) return fromQuery;
  const fromHeader = request.headers.get("x-admin-secret");
  if (fromHeader) return fromHeader;
  return null;
}

function isAuthorized(request: Request): boolean {
  const provided = readAdminSecret(request);
  if (!provided) return false;
  try {
    // Compare fixed-length digests so a length mismatch never reaches
    // `timingSafeEqual` and the secret value is never retained in logs.
    const providedDigest = createHash("sha256").update(provided, "utf8").digest();
    const expectedDigest = createHash("sha256").update(getGoogleOAuthAdminSecret(), "utf8").digest();
    return timingSafeEqual(providedDigest, expectedDigest);
  } catch {
    return false;
  }
}

/**
 * Temporary protected administrative route that starts the Google OAuth flow
 * for Nahuel's personal account against the primary Google Calendar.
 *
 * Requires `GOOGLE_OAUTH_ADMIN_SECRET` to be configured and the caller to
 * present it via the `?admin=` query parameter or the `x-admin-secret` header.
 * Returns 403 when the secret is missing/incorrect, and 500 when the OAuth
 * client env (`APP_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) is
 * not configured.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const state = randomUUID();
    const authUrl = buildAuthUrl(state);
    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "GOOGLE_OAUTH_NOT_CONFIGURED" },
      { status: 500 },
    );
  }
}
