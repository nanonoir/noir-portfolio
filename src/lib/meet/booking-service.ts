import "server-only";

import { MockAvailabilityRepository, type AvailabilityRepository } from "./availability-repository";
import { createBookingRecord } from "./booking-model";
import { MockBookingRepository, type BookingRepository } from "./booking-repository";
import { GoogleCalendarMockProvider, type CalendarProvider } from "./calendar-provider";
import { MEETING_ERROR_CODES, MEETING_RESPONSE_CODES } from "./codes";
import type { BookingErrorResponseDto, BookingRequestDto, BookingSuccessResponseDto } from "./dto";
import type { Timezone } from "./domain";
import { ResendMockProvider, type EmailProvider } from "./email-provider";
import { getSlotIdentity } from "./slot-identity";

export type BookingServiceResult = BookingSuccessResponseDto | BookingErrorResponseDto;

export class BookingService {
  constructor(
    private readonly availabilityRepository: AvailabilityRepository = new MockAvailabilityRepository(),
    private readonly bookingRepository: BookingRepository = new MockBookingRepository(),
    private readonly calendarProvider: CalendarProvider = new GoogleCalendarMockProvider(),
    private readonly emailProvider: EmailProvider = new ResendMockProvider(),
  ) {}

  async createBooking(request: BookingRequestDto): Promise<BookingServiceResult> {
    const existing = await this.bookingRepository.findByIdempotencyKey(request.idempotencyKey);

    if (existing) {
      return this.success(existing.id);
    }

    if (!(await this.isSlotAvailable(request))) {
      return this.error(MEETING_ERROR_CODES.SLOT_UNAVAILABLE);
    }

    const response = this.success(`meet_${crypto.randomUUID().slice(0, 8)}`);
    const reservation = await this.bookingRepository.reserveSlotIfAvailable({
      record: createBookingRecord(request, { id: response.meetingId }),
      slotIdentity: this.getSlotKey(request),
    });

    if (!reservation.success) {
      return this.error(reservation.error);
    }

    if (reservation.replayed) {
      return this.success(reservation.record.id);
    }

    const calendarResult = await this.calendarProvider.createEvent(reservation.record);
    const bookingWithProviderDetails = calendarResult.success
      ? ((await this.bookingRepository.updateProviderDetails(reservation.record.id, calendarResult.event)) ?? reservation.record)
      : reservation.record;

    await this.emailProvider.sendMeetingRequested({
      booking: bookingWithProviderDetails,
      payload: { meetingId: bookingWithProviderDetails.id, status: bookingWithProviderDetails.status },
      recipient: bookingWithProviderDetails.identity.email,
    });

    return response;
  }

  private async isSlotAvailable(request: BookingRequestDto) {
    const query = {
      date: request.meeting.date,
      timezone: request.meeting.timezone as Timezone,
    };

    if (!this.availabilityRepository.isAvailableDate(query)) {
      return false;
    }

    const slots = await this.availabilityRepository.getSlots(query);
    return slots.some((slot) => slot.time === request.meeting.time);
  }

  private getSlotKey(request: BookingRequestDto) {
    return getSlotIdentity({
      date: request.meeting.date,
      time: request.meeting.time,
      timezone: request.meeting.timezone as Timezone,
    });
  }

  private error(error: BookingErrorResponseDto["error"]): BookingServiceResult {
    return { success: false, error };
  }

  private success(meetingId: string): BookingSuccessResponseDto {
    return {
      success: true,
      code: MEETING_RESPONSE_CODES.REQUEST_ACCEPTED,
      meetingId,
      status: "requested",
    };
  }
}

export const bookingService = new BookingService();
