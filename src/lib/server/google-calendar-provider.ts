import "server-only";
import type { calendar_v3 } from "googleapis";

import { getEnv } from "./env";
import { createGoogleCalendarClient } from "./google-calendar-client";
import { withBoundedTimeout } from "./bounded-timeout";
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

/**
 * Phase 5 real Google Calendar + Google Meet provider (PRD §8, §13.5).
 *
 * Server-only: the OAuth refresh token, Calendar API, and Meet conference
 * request happen only on the server. The provider implements the existing
 * `CalendarProvider` port so the composition switch in `booking-service.ts`
 * can replace `GoogleCalendarMockProvider` when `GOOGLE_REFRESH_TOKEN` etc.
 * are configured.
 *
 * Deterministic event id (PRD §13.5 "Use deterministic provider identity to
 * prevent duplicate events"): the event id is derived exclusively from the
 * booking id. Replays with the same booking id return the existing event
 * (idempotent); `accept_proposal` re-uses the same event id and patches the
 * time slot instead of creating a duplicate.
 *
 * Cancel vs delete (PRD §8.3 "Cancel events rather than deleting them"):
 * `deleteEvent` patches `status: "cancelled"` so the event remains visible
 * as cancelled in Nahuel's Calendar instead of vanishing.
 */

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

/**
 * Deterministic Google Calendar event id derived from the booking id.
 *
 * Google Calendar event ids MUST be:
 *  - 5–1024 characters;
 *  - base32hex charset: lowercase letters a–v and digits 0–9.
 *
 * Booking IDs look like `meet_<8 hex chars>`. We strip the underscore (not
 * allowed), keep only a-v/0-9 chars, lowercase, and prefix `evt` if the
 * sanitized result is shorter than 5 chars. Booking UUID slices only contain
 * `0-9a-f`, which is a subset of base32hex.
 */
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

/**
 * Re-fetches one persisted event identity for webhook reconciliation. The
 * normalized snapshot deliberately excludes attendee comments and all other
 * Calendar payload fields: RSVP state is the only webhook input this phase
 * needs, and visitor content must not cross the provider boundary.
 */
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
  // `accept_proposal` carries the proposed slot's `startsAt` UTC instant;
  // otherwise we recompute from the visitor date/time/timezone so the API
  // call receives canonical UTC.
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

/**
 * Real `CalendarProvider` using Google Calendar + Google Meet.
 *
 * Configuration-aware: the composition switch in `booking-service.ts`
 * instantiates this only when `isGoogleCalendarConfigured()` is true. When
 * GOOGLE_REFRESH_TOKEN is absent, local no-env mode keeps the mock provider
 * for compatibility while Firebase-backed mode selects
 * `UnavailableCalendarProvider` (no fabricated event/Meet IDs, recoverable
 * delivery failure). Live validation requires Nahuel to seed the refresh
 * token in Vercel/local server env.
 */
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
        // Do not copy visitor message/lead content into the Calendar event.
        // The event only needs a stable support reference; the booking record
        // remains the server-only source of the visitor's original message.
        description: `Portfolio meeting reference: ${booking.id}`,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        attendees: [
          // Visitor: PRD §8.3 step 3 "Nahuel as organizer and the visitor as
          // attendee". Organizer is implicit (Calendar owner = organizer).
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

      // Phase 5 idempotency: googleapis returns 409 if the id already exists.
      // We catch that case and re-fetch the event to recover the Meet URL.
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

      // Conference creation can be asynchronous. Re-read once when the insert
      // response has no Meet video entry point; if Google still has not
      // produced one, report a recoverable provider failure rather than persist
      // an empty `googleMeetUrl` as a successful event.
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
        error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR,
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

      // If the event does not exist (e.g. mock ids that never round-tripped),
      // fall back to create for resilience.
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

      // The patch response does not always include conferenceData; re-read when
      // it is missing so we can return the Meet URL.
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
        error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR,
      };
    }
  }

  /**
   * `deleteEvent` cancels (PRD §8.3 "Cancel events rather than deleting them").
   * The event remains visible as cancelled in the Calendar and Meet link
   * becomes unavailable to the visitor. Returns the supplied calendarEventId
   * back so the caller can persist the cancellation trace.
   */
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
        error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR,
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
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
    }
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return isGoogleApiErrorWithStatus(error, 409) || messageMatches(error, /already exists/i);
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
