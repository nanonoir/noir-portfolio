import "server-only";
import type { calendar_v3 } from "googleapis";

import { getEnv } from "./env";
import { createGoogleCalendarClient } from "./google-calendar-client";
import { withBoundedTimeout } from "./bounded-timeout";
import { BoundedTimeoutError } from "./bounded-timeout";
import { refreshAccessToken } from "./google-oauth";
import {
  CALENDAR_PROVIDER_ERROR_CODES,
  type CalendarProvider,
  type CalendarProviderResult,
} from "@/lib/meet/calendar-provider";
import type { BookingRecord } from "@/lib/meet/booking-model";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";
import { getZonedDateTime } from "@/lib/meet/zoned-date-time";
import { addMeetingDuration } from "@/lib/meet/duration";
import {
  GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS,
  GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS,
} from "@/lib/meet/deadlines";

/** Server-only Google Calendar and Meet provider with deterministic event ids. */

export const GOOGLE_CALENDAR_RSVP_STATUSES = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  NEEDS_ACTION: "needsAction",
  TENTATIVE: "tentative",
} as const;

export type GoogleCalendarRsvpStatus =
  (typeof GOOGLE_CALENDAR_RSVP_STATUSES)[keyof typeof GOOGLE_CALENDAR_RSVP_STATUSES];

export interface GoogleCalendarEventAttendee {
  email: string;
  organizer: boolean;
  responseStatus: GoogleCalendarRsvpStatus | null;
}

export interface GoogleCalendarEventSnapshot {
  attendees: readonly GoogleCalendarEventAttendee[];
  calendarEventId: string;
  status: string | null;
}

export const GOOGLE_CALENDAR_EVENT_FETCH_RESULTS = {
  NOT_FOUND: "not_found",
} as const;

export type GoogleCalendarEventFetchResult =
  | GoogleCalendarEventSnapshot
  | null
  | (typeof GOOGLE_CALENDAR_EVENT_FETCH_RESULTS)[keyof typeof GOOGLE_CALENDAR_EVENT_FETCH_RESULTS];

let cachedCalendarId: string | null = null;
export { GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS } from "@/lib/meet/deadlines";

function getCalendarId(): string {
  if (cachedCalendarId !== null) return cachedCalendarId;
  cachedCalendarId = getEnv("GOOGLE_CALENDAR_ID") ?? "primary";
  return cachedCalendarId;
}

/** Builds a deterministic Google event id using the provider's base32hex rules. */
export function buildDeterministicEventId(bookingId: string): string {
  const sanitized = bookingId
    .toLowerCase()
    .split("")
    .filter((char) => /^[a-v0-9]$/.test(char))
    .join("");
  const candidate = sanitized.length >= 5 ? sanitized : `evt${sanitized}`.padEnd(5, "0");
  return candidate.slice(0, 64);
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    getEnv("GOOGLE_REFRESH_TOKEN") &&
      getEnv("GOOGLE_CLIENT_ID") &&
      getEnv("GOOGLE_CLIENT_SECRET"),
  );
}

/** Re-fetches only RSVP-relevant event fields; visitor content stays server-side. */
export async function fetchGoogleCalendarEvent(
  calendarEventId: string,
): Promise<GoogleCalendarEventFetchResult> {
  if (!isGoogleCalendarConfigured()) return null;

  try {
    const response = await withBoundedTimeout(async (signal) => {
      const accessToken = await refreshAccessToken(
        getEnv("GOOGLE_REFRESH_TOKEN")!,
        GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS,
      );
      const calendar = createGoogleCalendarClient(accessToken, GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS);
      return calendar.events.get({
        calendarId: getCalendarId(),
        eventId: calendarEventId,
      }, {
        signal,
        timeout: GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS,
      });
    }, GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS);
    const event = response.data;

    return {
      attendees: (event.attendees ?? []).flatMap((attendee) => {
        const email = attendee.email?.trim().toLowerCase();
        if (!email) return [];
        return [{
          email,
          organizer: attendee.organizer === true,
          responseStatus: isGoogleCalendarRsvpStatus(attendee.responseStatus)
            ? attendee.responseStatus
            : null,
        }];
      }),
      calendarEventId: event.id ?? calendarEventId,
      status: event.status ?? null,
    };
  } catch (error) {
    if (isNotFoundError(error)) return GOOGLE_CALENDAR_EVENT_FETCH_RESULTS.NOT_FOUND;
    logError("calendar.google.webhook_fetch_error", calendarEventId, error);
    return null;
  }
}

/** Helper: build a calendar date-time string + duration end for an event. */
function buildEventTimeWindows(booking: BookingRecord): {
  startISO: string;
  endISO: string;
} {
  // Use the proposed UTC instant when available; otherwise recompute it.
  let startInstant: Date;
  if (booking.proposedSlot) {
    startInstant = new Date(booking.proposedSlot.startsAt);
  } else {
    startInstant = getZonedDateTime({
      date: booking.meeting.date,
      time: booking.meeting.time,
      timezone: booking.visitorTimezone,
    });
  }

  if (Number.isNaN(startInstant.getTime())) {
    throw new Error(`Invalid meeting start: ${booking.meeting.date} ${booking.meeting.time}`);
  }

  const endInstant = addMeetingDuration(startInstant);
  return { startISO: startInstant.toISOString(), endISO: endInstant.toISOString() };
}

function describeBookingSummary(booking: BookingRecord): string {
  if (booking.origin === "contact") {
    return `Meeting with ${booking.identity.name} (contact: ${booking.reason ?? "general"})`;
  }
  return `Meeting with ${booking.identity.name} (service: ${booking.relatedService ?? booking.previousRequest?.service ?? "general"})`;
}

function toResult(event: calendar_v3.Schema$Event): CalendarProviderResult {
  const calendarEventId = event.id ?? "";
  const googleMeetUrl = extractMeetUrl(event);
  return { success: true, event: { calendarEventId, googleMeetUrl } };
}

function extractMeetUrl(event: calendar_v3.Schema$Event): string {
  const entryPoints = event.conferenceData?.entryPoints;
  if (!Array.isArray(entryPoints)) return "";
  const video = entryPoints.find((ep) => ep.entryPointType === "video");
  return video?.uri ?? "";
}

function logError(event: string, bookingId: string, error: unknown) {
  meetLogger.error(event, { bookingId, cause: normalizeErrorCause(error), provider: "calendar" });
}

/** Configuration-aware Google Calendar and Meet provider. */
export class GoogleCalendarProvider implements CalendarProvider {
  async createEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    return this.runBounded((signal) => this.createEventWithinDeadline(booking, signal), booking.id, "create");
  }

  private async createEventWithinDeadline(
    booking: BookingRecord,
    signal: AbortSignal,
  ): Promise<CalendarProviderResult> {
    try {
      const accessToken = await refreshAccessToken(getEnv("GOOGLE_REFRESH_TOKEN")!, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendar = createGoogleCalendarClient(accessToken, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendarId = getCalendarId();
      const eventId = buildDeterministicEventId(booking.id);
      const { startISO, endISO } = buildEventTimeWindows(booking);

      const requestBody: calendar_v3.Schema$Event = {
        id: eventId,
        summary: describeBookingSummary(booking),
        // Keep visitor message content server-side; Calendar gets a stable reference.
        description: `Portfolio meeting reference: ${booking.id}`,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        attendees: [
          // Calendar owner is the organizer; the visitor is the attendee.
          { email: booking.identity.email, displayName: booking.identity.name },
        ],
        conferenceData: {
          createRequest: { requestId: eventId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: true,
        status: "confirmed",
        transparency: "opaque",
      };

      // A 409 means the deterministic event already exists; re-fetch it.
      let inserted: calendar_v3.Schema$Event;
      try {
        const insertRes = await calendar.events.insert(
          {
            calendarId,
            requestBody,
            conferenceDataVersion: 1,
            sendUpdates: "all",
          },
          { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
        );
        inserted = insertRes.data;
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          const existingRes = await calendar.events.get(
            { calendarId, eventId },
            { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
          );
          inserted = existingRes.data;
        } else {
          throw error;
        }
      }

      // Re-read asynchronous conference data before accepting the event.
      if (!extractMeetUrl(inserted)) {
        const refetch = await calendar.events.get(
          { calendarId, eventId },
          { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
        );
        inserted = refetch.data;
      }
      if (!extractMeetUrl(inserted)) {
        throw new Error("Google Meet conference URL was not generated yet.");
      }

      return toResult(inserted);
    } catch (error) {
      logError("calendar.google.create_error", booking.id, error);
      return {
        success: false,
        error: classifyCalendarFailure(error),
      };
    }
  }

  async updateEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    return this.runBounded((signal) => this.updateEventWithinDeadline(booking, signal), booking.id, "update");
  }

  private async updateEventWithinDeadline(
    booking: BookingRecord,
    signal: AbortSignal,
  ): Promise<CalendarProviderResult> {
    try {
      const accessToken = await refreshAccessToken(getEnv("GOOGLE_REFRESH_TOKEN")!, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendar = createGoogleCalendarClient(accessToken, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendarId = getCalendarId();
      const eventId = booking.calendarEventId ?? buildDeterministicEventId(booking.id);
      const { startISO, endISO } = buildEventTimeWindows(booking);

      const requestBody: calendar_v3.Schema$Event = {
        summary: describeBookingSummary(booking),
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        attendees: [
          { email: booking.identity.email, displayName: booking.identity.name },
        ],
        status: "confirmed",
      };

      // A missing event falls back to creation.
      let updated: calendar_v3.Schema$Event;
      try {
        const patchRes = await calendar.events.patch(
          {
            calendarId,
            eventId,
            requestBody,
            conferenceDataVersion: 1,
            sendUpdates: "all",
          },
          { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
        );
        updated = patchRes.data;
      } catch (error) {
        if (isNotFoundError(error)) {
          return this.createEventWithinDeadline(booking, signal);
        }
        throw error;
      }

      // Re-read when the patch response omits conference data.
      if (!updated.conferenceData && !extractMeetUrl(updated)) {
        const refetch = await calendar.events.get(
          { calendarId, eventId },
          { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
        );
        updated = refetch.data;
      }

      if (!extractMeetUrl(updated)) {
        throw new Error("Google Meet conference URL is unavailable after event update.");
      }

      return toResult(updated);
    } catch (error) {
      logError("calendar.google.update_error", booking.id, error);
      return {
        success: false,
        error: classifyCalendarFailure(error),
      };
    }
  }

  /** Cancels the event while preserving its Calendar audit trail. */
  async deleteEvent(calendarEventId: string): Promise<CalendarProviderResult> {
    return this.runBounded((signal) => this.deleteEventWithinDeadline(calendarEventId, signal), "", "delete");
  }

  private async deleteEventWithinDeadline(
    calendarEventId: string,
    signal: AbortSignal,
  ): Promise<CalendarProviderResult> {
    try {
      const accessToken = await refreshAccessToken(getEnv("GOOGLE_REFRESH_TOKEN")!, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendar = createGoogleCalendarClient(accessToken, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
      const calendarId = getCalendarId();

      let event: calendar_v3.Schema$Event;
      try {
        const patchRes = await calendar.events.patch(
          {
            calendarId,
            eventId: calendarEventId,
            requestBody: { status: "cancelled" },
            sendUpdates: "all",
          },
          { signal, timeout: GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS },
        );
        event = patchRes.data;
      } catch (error) {
        if (isNotFoundError(error)) {
          // Already gone — treat as a successful no-op cancel.
          event = { id: calendarEventId, status: "cancelled" };
        } else {
          throw error;
        }
      }

      return {
        success: true,
        event: { calendarEventId: event.id ?? calendarEventId, googleMeetUrl: extractMeetUrl(event) },
      };
    } catch (error) {
      logError("calendar.google.delete_error", "", error);
      return {
        success: false,
        error: classifyCalendarFailure(error),
      };
    }
  }

  private async runBounded(
    operation: (signal: AbortSignal) => Promise<CalendarProviderResult>,
    bookingId: string,
    action: "create" | "update" | "delete",
  ): Promise<CalendarProviderResult> {
    try {
      return await withBoundedTimeout(operation, GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
    } catch (error) {
      logError(`calendar.google.${action}_timeout`, bookingId, error);
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_TIMEOUT };
    }
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return isGoogleApiErrorWithStatus(error, 409) || messageMatches(error, /already exists/i);
}

function classifyCalendarFailure(error: unknown) {
  if (error instanceof BoundedTimeoutError) return CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_TIMEOUT;
  if (isAuthenticationFailure(error)) return CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_AUTHENTICATION;
  if (isConfigurationFailure(error)) return CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_CONFIGURATION;
  return CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_TRANSIENT;
}

function isAuthenticationFailure(error: unknown): boolean {
  return hasStatus(error, 401) || hasStatus(error, 403) || messageMatches(error, /invalid[_ -]?grant|unauthori[sz]ed|forbidden|credential/i);
}

function isConfigurationFailure(error: unknown): boolean {
  return messageMatches(error, /missing|required.*(?:google|calendar)|not configured/i);
}

function hasStatus(error: unknown, status: number): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = (error as { response?: { status?: unknown }; status?: unknown }).response?.status
    ?? (error as { status?: unknown }).status;
  return value === status;
}

function isGoogleCalendarRsvpStatus(value: unknown): value is GoogleCalendarRsvpStatus {
  return typeof value === "string" && Object.values(GOOGLE_CALENDAR_RSVP_STATUSES).includes(
    value as GoogleCalendarRsvpStatus,
  );
}

function isNotFoundError(error: unknown): boolean {
  return isGoogleApiErrorWithStatus(error, 404) || messageMatches(error, /not found/i);
}

function isGoogleApiErrorWithStatus(error: unknown, status: number): boolean {
  if (typeof error !== "object" || error === null) return false;
  const errors = (error as { errors?: Array<{ reason?: string; code?: number }> }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.some((e) => e.code === status);
  }
  // googleapis errors also expose `code` directly for HTTP status codes.
  const code = (error as { code?: number }).code;
  if (typeof code === "number" && code === status) return true;
  const responseStatus = (error as { response?: { status?: number } }).response?.status;
  return typeof responseStatus === "number" && responseStatus === status;
}

function messageMatches(error: unknown, pattern: RegExp): boolean {
  if (error instanceof Error) return pattern.test(error.message);
  if (typeof error === "string") return pattern.test(error);
  return false;
}
