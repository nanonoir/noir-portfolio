import "server-only";

import type { BookingRecord } from "./booking-model";
import { meetLogger, normalizeErrorCause } from "./logger";

export const CALENDAR_PROVIDER_ERROR_CODES = {
  CALENDAR_PROVIDER_AUTHENTICATION: "CALENDAR_PROVIDER_AUTHENTICATION",
  CALENDAR_PROVIDER_CONFIGURATION: "CALENDAR_PROVIDER_CONFIGURATION",
  CALENDAR_PROVIDER_ERROR: "CALENDAR_PROVIDER_ERROR",
  CALENDAR_PROVIDER_TIMEOUT: "CALENDAR_PROVIDER_TIMEOUT",
  CALENDAR_PROVIDER_TRANSIENT: "CALENDAR_PROVIDER_TRANSIENT",
} as const;

export type CalendarProviderErrorCode =
  (typeof CALENDAR_PROVIDER_ERROR_CODES)[keyof typeof CALENDAR_PROVIDER_ERROR_CODES];

export interface CalendarEventReference {
  calendarEventId: string;
  googleMeetUrl: string;
}

export interface CalendarProviderSuccess {
  success: true;
  event: CalendarEventReference;
}

export interface CalendarProviderFailure {
  success: false;
  error: CalendarProviderErrorCode;
}

export type CalendarProviderResult = CalendarProviderSuccess | CalendarProviderFailure;

export interface CalendarProvider {
  createEvent(booking: BookingRecord): Promise<CalendarProviderResult>;
  updateEvent(booking: BookingRecord): Promise<CalendarProviderResult>;
  deleteEvent(calendarEventId: string): Promise<CalendarProviderResult>;
}

function createMockEventReference(bookingId: string): CalendarEventReference {
  const eventSuffix = bookingId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase();

  return {
    calendarEventId: `mock-calendar-${eventSuffix}`,
    googleMeetUrl: `https://meet.google.com/mock-${eventSuffix}`,
  };
}

export class GoogleCalendarMockProvider implements CalendarProvider {
  async createEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    try {
      return { success: true, event: createMockEventReference(booking.id) };
    } catch (error) {
      meetLogger.error("calendar.mock.create_error", { bookingId: booking.id, cause: normalizeErrorCause(error) });
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
    }
  }

  async updateEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    try {
      return { success: true, event: createMockEventReference(booking.id) };
    } catch (error) {
      meetLogger.error("calendar.mock.update_error", { bookingId: booking.id, cause: normalizeErrorCause(error) });
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
    }
  }

  async deleteEvent(calendarEventId: string): Promise<CalendarProviderResult> {
    try {
      const eventSuffix = calendarEventId.replace(/^mock-calendar-/, "");

      return {
        success: true,
        event: {
          calendarEventId,
          googleMeetUrl: `https://meet.google.com/mock-${eventSuffix}`,
        },
      };
    } catch (error) {
      meetLogger.error("calendar.mock.delete_error", { cause: normalizeErrorCause(error), provider: "calendar" });
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
    }
  }
}

/** Fails closed without fabricating event identities when Google is unavailable. */
export class UnavailableCalendarProvider implements CalendarProvider {
  async createEvent(): Promise<CalendarProviderResult> {
    return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
  }

  async updateEvent(): Promise<CalendarProviderResult> {
    return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
  }

  async deleteEvent(): Promise<CalendarProviderResult> {
    return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
  }
}
