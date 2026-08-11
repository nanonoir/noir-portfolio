import "server-only";
import { google } from "googleapis";

import { getEnv, requireEnv } from "./env";
import { createGoogleOAuth2Client } from "./google-calendar-client";

/** Protected administrative OAuth helpers for the primary Calendar. */

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];

function createOAuth2Client(timeoutMs?: number) {
  return createGoogleOAuth2Client(getOAuthRedirectUrl(), timeoutMs);
}

export function getOAuthRedirectUrl(): string {
  const baseUrl = requireEnv("APP_BASE_URL").replace(/\/+$/, "");
  return `${baseUrl}/api/admin/google-oauth/callback`;
}

export function getGoogleOAuthAdminSecret(): string {
  return requireEnv("GOOGLE_OAUTH_ADMIN_SECRET");
}

export function buildAuthUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    prompt: "consent",
    include_granted_scopes: true,
    state,
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<{
  refresh_token: string | null;
  access_token: string | null;
  expires_in?: number;
}> {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return {
    refresh_token: tokens.refresh_token ?? null,
    access_token: tokens.access_token ?? null,
    expires_in: tokens.expiry_date
      ? Math.max(0, Math.round((tokens.expiry_date - Date.now()) / 1000))
      : undefined,
  };
}

export async function refreshAccessToken(refreshToken: string, timeoutMs?: number): Promise<string> {
  // OAuth2.refreshAccessToken does not accept an AbortSignal. Its documented
  // `transporterOptions.timeout` path is configured by createOAuth2Client.
  const oauth2 = createOAuth2Client(timeoutMs);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  const accessToken = credentials.access_token;
  if (!accessToken) {
    throw new Error("Google OAuth refresh failed: no access token returned.");
  }
  return accessToken;
}

export async function validatePrimaryCalendarAccess(
  refreshToken: string,
): Promise<{ calendarId: string; ok: boolean }> {
  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const calendarId = getEnv("GOOGLE_CALENDAR_ID") ?? "primary";
  const res = await calendar.calendarList.get({ calendarId });
  return { calendarId, ok: Boolean(res.data.id) };
}
