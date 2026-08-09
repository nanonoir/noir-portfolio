import { ActionService, issueOwnerTokensForNewBooking } from "@/lib/meet/action-service";
import { MockAvailabilityRepository } from "@/lib/meet/availability-repository";
import { FirestoreActionTokenRepository } from "@/lib/meet/firestore-action-token-repository";
import { FirestoreBookingRepository } from "@/lib/meet/firestore-booking-repository";
import { createBookingRecord, type BookingRecord } from "@/lib/meet/booking-model";
import { BookingService } from "@/lib/meet/booking-service";
import { GoogleCalendarMockProvider } from "@/lib/meet/calendar-provider";
import type { BookingRequestDto } from "@/lib/meet/dto";
import { ResendMockProvider } from "@/lib/meet/email-provider";
import { NoopMeetLogger } from "@/lib/meet/logger";
import { clearFirestore } from "./firebase-emulator";

/** Uses real emulator persistence while stopping external providers at mocks. */
export function createBackendTestComposition() {
  const availabilityRepository = new MockAvailabilityRepository();
  const bookingRepository = new FirestoreBookingRepository();
  const tokenRepository = new FirestoreActionTokenRepository();
  const calendarProvider = new GoogleCalendarMockProvider();
  const emailProvider = new ResendMockProvider();
  const actionService = new ActionService(
    bookingRepository,
    availabilityRepository,
    () => new Date(),
    tokenRepository,
    calendarProvider,
    emailProvider,
  );
  const bookingService = new BookingService(
    availabilityRepository,
    bookingRepository,
    calendarProvider,
    emailProvider,
    new NoopMeetLogger(),
    actionService,
  );

  return { actionService, availabilityRepository, bookingRepository, bookingService, calendarProvider, emailProvider, tokenRepository };
}

export async function resetBackendTestFirestore() {
  await clearFirestore();
}

export async function seedBackendActionBooking(request: BookingRequestDto): Promise<{
  booking: BookingRecord;
  tokens: Readonly<Record<"confirm" | "decline" | "propose", string>>;
}> {
  const { actionService, bookingRepository } = createBackendTestComposition();
  const booking = await bookingRepository.create(createBookingRecord(request, {
    id: `e2e_${crypto.randomUUID().slice(0, 8)}`,
  }));
  const issued = await issueOwnerTokensForNewBooking(actionService, booking);
  const tokens = Object.fromEntries(issued.map(({ record, token }) => [record.action, token])) as Record<"confirm" | "decline" | "propose", string>;

  return { booking, tokens };
}
