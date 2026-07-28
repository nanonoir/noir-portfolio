import "server-only";

import { google } from "googleapis";

import { GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS } from "@/lib/meet/deadlines";
import { getEnv, requireEnv } from "./env";

/**
 * The Calendar operation budget leaves 1.5 seconds of a Vercel function's
 * 10-second limit for durable recovery and response handling. Individual
 * Calendar requests also receive this deadline through documented Gaxios
 * request options.
 */
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

/**
 * Creates the Calendar client with the documented OAuth2/Gaxios transport
 * timeout. Calendar API calls may additionally pass a request-level timeout
 * and AbortSignal as their second `googleapis` options argument.
 */
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
