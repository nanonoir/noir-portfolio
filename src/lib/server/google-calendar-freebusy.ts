import "server-only";
import { GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS } from "@/lib/meet/deadlines";
import { getEnv } from "./env";
import { createGoogleCalendarClient } from "./google-calendar-client";
import { refreshAccessToken } from "./google-oauth";
import { withBoundedTimeout } from "./bounded-timeout";

/**
 * Google Calendar FreeBusy query against the primary calendar (PRD §4.1).
 *
 * Phase 3 availability provider boundary: this module is server-only, talks
 * to Google through the Phase 1 OAuth2 refresh-token flow, and exposes one
 * pure-ish function: given a UTC window, return the busy intervals on the
 * primary calendar.
 *
 * No event creation, update, or deletion happens here — those remain Phase 5
 * behind the existing `CalendarProvider` port. This module never exposes
 * visitor data to Google beyond the meeting window itself.
 */

export interface BusyInterval {
  startISO: string;
  endISO: string;
}

export class FreeBusyError extends Error {
  constructor(
    message: string,
    readonly code: "FREEBUSY_CONFIG_MISSING" | "FREEBUSY_PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "FreeBusyError";
  }
}

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
      "FREEBUSY_CONFIG_MISSING",
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
    throw new FreeBusyError(
      `Google FreeBusy query failed: ${error instanceof Error ? error.message : "unknown error"}`,
      "FREEBUSY_PROVIDER_ERROR",
    );
  }
}
