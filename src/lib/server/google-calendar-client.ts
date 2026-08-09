import "server-only";

import { google } from "googleapis";

import { GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS } from "@/lib/meet/deadlines";
import { getEnv, requireEnv } from "./env";

/** Calendar requests share the bounded operation deadline. */
/** @deprecated Import GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS from meet/deadlines. */
export const PROVIDER_TIMEOUT_MS = GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS;

export function createGoogleOAuth2Client(redirectUri?: string, timeoutMs?: number) {
  return new google.auth.OAuth2(
    {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirectUri,
      ...(timeoutMs === undefined ? {} : { transporterOptions: { timeout: timeoutMs } }),
    },
  );
}

/** Creates a Calendar client with OAuth transport timeout configuration. */
export function createGoogleCalendarClient(accessToken: string, timeoutMs?: number) {
  const oauth2 = new google.auth.OAuth2(
    {
      clientId: getEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
      ...(timeoutMs === undefined ? {} : { transporterOptions: { timeout: timeoutMs } }),
    },
  );
  oauth2.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2 });
}
