import "server-only";

import { isBackendE2ETestComposition, isFirebaseConfigured } from "@/lib/server/env";
import { isGoogleCalendarConfigured, GoogleCalendarProvider } from "@/lib/server/google-calendar-provider";
import {
  isResendEmailConfigured,
  ResendEmailProvider,
  UnavailableEmailProvider,
} from "@/lib/server/resend-email-provider";
import { ActionService } from "./action-service";
import { MockActionTokenRepository, type ActionTokenRepository } from "./action-token-repository";
import { createAvailabilityRepository } from "./availability-service";
import { BookingService } from "./booking-service";
import { FirestoreActionTokenRepository } from "./firestore-action-token-repository";
import { FirestoreBookingRepository } from "./firestore-booking-repository";
import { meetLogger, normalizeErrorCause } from "./logger";
import { MockBookingRepository, type BookingRepository } from "./booking-repository";
import { GoogleCalendarMockProvider, UnavailableCalendarProvider, type CalendarProvider } from "./calendar-provider";
import { ResendMockProvider, type EmailProvider } from "./email-provider";

/**
 * This opt-in exists only for the local Playwright backend lane. It keeps the
 * real Firestore repositories while preventing Google/Resend network calls.
 */
function createBookingRepository(): BookingRepository {
  if (isFirebaseConfigured() || isBackendE2ETestComposition()) {
    try {
      return new FirestoreBookingRepository();
    } catch (error) {
      meetLogger.error("booking.repository.firestore_init_failed", { cause: normalizeErrorCause(error) });
    }
  }
  return new MockBookingRepository();
}

function createCalendarProvider(): CalendarProvider {
  if (isBackendE2ETestComposition()) return new GoogleCalendarMockProvider();
  if (isGoogleCalendarConfigured()) return new GoogleCalendarProvider();
  return isFirebaseConfigured() ? new UnavailableCalendarProvider() : new GoogleCalendarMockProvider();
}

function createEmailProvider(): EmailProvider {
  if (isBackendE2ETestComposition()) return new ResendMockProvider();
  if (isResendEmailConfigured()) return new ResendEmailProvider();
  return isFirebaseConfigured() ? new UnavailableEmailProvider() : new ResendMockProvider();
}

function createActionTokenRepository(): ActionTokenRepository {
  if (isFirebaseConfigured() || isBackendE2ETestComposition()) {
    try {
      return new FirestoreActionTokenRepository();
    } catch (error) {
      meetLogger.error("action_token.repository.firestore_init_failed", { cause: normalizeErrorCause(error) });
    }
  }
  return new MockActionTokenRepository();
}

// Discovery and booking MUST share the same availability provider. In the
// Firebase-without-FreeBusy safe-degraded mode, discovery returns every valid
// canonical UTC slot; using the legacy hash-filtered mock here would allow GET
// to advertise a slot that POST subsequently rejects.
const availabilityRepository = createAvailabilityRepository();
export const bookingRepository = createBookingRepository();
const calendarProvider = createCalendarProvider();
const emailProvider = createEmailProvider();
const tokenRepository = createActionTokenRepository();

export const actionService = new ActionService(
  bookingRepository,
  availabilityRepository,
  () => new Date(),
  tokenRepository,
  calendarProvider,
  emailProvider,
);

export const bookingService = new BookingService(
  availabilityRepository,
  bookingRepository,
  calendarProvider,
  emailProvider,
  meetLogger,
  actionService,
);
