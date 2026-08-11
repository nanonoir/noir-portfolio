import "server-only";
import { GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS } from "@/lib/meet/deadlines";
import { getEnv } from "./env";
import { createGoogleCalendarClient } from "./google-calendar-client";
import { refreshAccessToken } from "./google-oauth";
import { withBoundedTimeout } from "./bounded-timeout";
import { BoundedTimeoutError } from "./bounded-timeout";

/** Queries primary-calendar busy intervals without sending visitor content. */

export interface BusyInterval {
  startISO: string;
  endISO: string;
}

export class FreeBusyError extends Error {
  constructor(
    message: string,
    readonly code: (typeof FREEBUSY_ERROR_CODES)[keyof typeof FREEBUSY_ERROR_CODES],
  ) {
    super(message);
    this.name = "FreeBusyError";
  }
}

export const FREEBUSY_ERROR_CODES = {
  AUTHENTICATION: "FREEBUSY_AUTHENTICATION",
  CONFIG_MISSING: "FREEBUSY_CONFIG_MISSING",
  PROVIDER_ERROR: "FREEBUSY_PROVIDER_ERROR",
  TIMEOUT: "FREEBUSY_TIMEOUT",
  TRANSIENT: "FREEBUSY_TRANSIENT",
} as const;

let cachedCalendarId: string | null = null;

function getCalendarId(): string {
  if (cachedCalendarId !== null) return cachedCalendarId;
  cachedCalendarId = getEnv("GOOGLE_CALENDAR_ID") ?? "primary";
  return cachedCalendarId;
}

export function isFreeBusyConfigured(): boolean {
  return Boolean(getEnv("GOOGLE_REFRESH_TOKEN") && getEnv("GOOGLE_CLIENT_ID") && getEnv("GOOGLE_CLIENT_SECRET"));
}

export async function queryPrimaryCalendarFreeBusy(
  windowStartISO: string,
  windowEndISO: string,
): Promise<BusyInterval[]> {
  if (!isFreeBusyConfigured()) {
    throw new FreeBusyError(
      "GOOGLE_REFRESH_TOKEN (and GOOGLE_CLIENT_ID/SECRET) must be configured to query FreeBusy.",
      FREEBUSY_ERROR_CODES.CONFIG_MISSING,
    );
  }

  try {
    const response = await withBoundedTimeout(async (signal) => {
      const refreshToken = getEnv("GOOGLE_REFRESH_TOKEN")!;
      const accessToken = await refreshAccessToken(refreshToken, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendar = createGoogleCalendarClient(accessToken, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendarId = getCalendarId();

      return calendar.freebusy.query(
        {
          requestBody: {
            timeMin: windowStartISO,
            timeMax: windowEndISO,
            items: [{ id: calendarId }],
          },
        },
        { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
      );
    }, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);

    const calendars = response.data.calendars ?? {};
    const calendarEntry = calendars[String(getCalendarId())] ?? {};
    const busyRaw = Array.isArray(calendarEntry.busy) ? calendarEntry.busy : [];

    const intervals: BusyInterval[] = [];
    for (const entry of busyRaw) {
      const start = entry.start;
      const end = entry.end;
      if (!start || !end) continue;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue;
      intervals.push({ startISO: startDate.toISOString(), endISO: endDate.toISOString() });
    }

    return intervals;
  } catch (error) {
    if (error instanceof BoundedTimeoutError) {
      throw new FreeBusyError("Google FreeBusy query timed out.", FREEBUSY_ERROR_CODES.TIMEOUT);
    }
    throw new FreeBusyError(
      `Google FreeBusy query failed: ${error instanceof Error ? error.message : "unknown error"}`,
      classifyFreeBusyFailure(error),
    );
  }
}

function classifyFreeBusyFailure(error: unknown) {
  if (hasStatus(error, 401) || hasStatus(error, 403) || messageMatches(
    error,
    /invalid[_ -]?grant|unauthori[sz]ed|forbidden|invalid client|invalid credential|refresh token.*invalid/i,
  )) {
    return FREEBUSY_ERROR_CODES.AUTHENTICATION;
  }

  if (messageMatches(error, /missing|required.*(?:google|calendar)|not configured/i)) {
    return FREEBUSY_ERROR_CODES.CONFIG_MISSING;
  }

  return FREEBUSY_ERROR_CODES.TRANSIENT;
}

function hasStatus(error: unknown, status: number): boolean {
  if (typeof error !== "object" || error === null) return false;
  const errors = (error as { errors?: Array<{ code?: number }> }).errors;
  if (Array.isArray(errors) && errors.some((entry) => entry.code === status)) return true;
  const directCode = (error as { code?: unknown }).code;
  const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
  return directCode === status || responseStatus === status || (error as { status?: unknown }).status === status;
}

function messageMatches(error: unknown, pattern: RegExp): boolean {
  if (error instanceof Error) return pattern.test(error.message);
  if (typeof error === "string") return pattern.test(error);
  return false;
}
