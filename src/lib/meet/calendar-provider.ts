import "server-only";

import type { BookingRecord } from "./booking-model";

export const CALENDAR_PROVIDER_ERROR_CODES = {
  CALENDAR_PROVIDER_ERROR: "CALENDAR_PROVIDER_ERROR",
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
    return { success: true, event: createMockEventReference(booking.id) };
  }

  async updateEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    return { success: true, event: createMockEventReference(booking.id) };
  }

  async deleteEvent(calendarEventId: string): Promise<CalendarProviderResult> {
    const eventSuffix = calendarEventId.replace(/^mock-calendar-/, "");

    return {
      success: true,
      event: {
        calendarEventId,
        googleMeetUrl: `https://meet.google.com/mock-${eventSuffix}`,
      },
    };
  }
}
