import { ActionService } from "@/lib/meet/action-service";
import { MockActionTokenRepository } from "@/lib/meet/action-token-repository";
import { MockAvailabilityRepository } from "@/lib/meet/availability-repository";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import { GoogleCalendarMockProvider } from "@/lib/meet/calendar-provider";
import { ResendMockProvider } from "@/lib/meet/email-provider";

import { fixedClock, type FixedClock } from "./time";

const DEFAULT_CLOCK = "2026-08-03T12:00:00.000Z";

export interface CreateTestActionServiceOptions {
  now?: () => Date;
}

export interface TestActionServiceHarness {
  actionService: ActionService;
  availabilityRepository: MockAvailabilityRepository;
  bookingRepository: MockBookingRepository;
  calendarProvider: GoogleCalendarMockProvider;
  clock: FixedClock | null;
  emailProvider: ResendMockProvider;
  tokenRepository: MockActionTokenRepository;
}

export function createTestActionService(
  options: CreateTestActionServiceOptions = {},
): TestActionServiceHarness {
  const defaultClock = fixedClock(DEFAULT_CLOCK);
  const now = options.now ?? defaultClock.now;
  const availabilityRepository = new MockAvailabilityRepository(now);
  const bookingRepository = new MockBookingRepository();
  const calendarProvider = new GoogleCalendarMockProvider();
  const emailProvider = new ResendMockProvider();
  const tokenRepository = new MockActionTokenRepository();

  return {
    actionService: new ActionService(
      bookingRepository,
      availabilityRepository,
      now,
      tokenRepository,
      calendarProvider,
      emailProvider,
    ),
    availabilityRepository,
    bookingRepository,
    calendarProvider,
    clock: options.now ? null : defaultClock,
    emailProvider,
    tokenRepository,
  };
}
