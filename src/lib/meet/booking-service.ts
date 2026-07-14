import "server-only";

import { MockAvailabilityRepository, type AvailabilityRepository } from "./availability-repository";
import { createBookingPayloadHash, createBookingRecord, type BookingRecord } from "./booking-model";
import { MockBookingRepository, type BookingRepository } from "./booking-repository";
import { GoogleCalendarMockProvider, type CalendarProvider } from "./calendar-provider";
import { MEETING_ERROR_CODES, MEETING_RESPONSE_CODES } from "./codes";
import type { BookingErrorResponseDto, BookingRequestDto, BookingSuccessResponseDto } from "./dto";
import type { Timezone } from "./domain";
import { ResendMockProvider, type EmailProvider } from "./email-provider";
import { NoopMeetLogger, normalizeErrorCause, type MeetLogger } from "./logger";
import { getSlotIdentity } from "./slot-identity";

export type BookingServiceResult = BookingSuccessResponseDto | BookingErrorResponseDto;

export class BookingService {
  constructor(
    private readonly availabilityRepository: AvailabilityRepository = new MockAvailabilityRepository(),
    private readonly bookingRepository: BookingRepository = new MockBookingRepository(),
    private readonly calendarProvider: CalendarProvider = new GoogleCalendarMockProvider(),
    private readonly emailProvider: EmailProvider = new ResendMockProvider(),
    private readonly logger: MeetLogger = new NoopMeetLogger(),
  ) {}

  async createBooking(request: BookingRequestDto): Promise<BookingServiceResult> {
    try {
      return await this.createBookingInternal(request);
    } catch (error) {
      this.logger.error("booking.unexpected_error", {
        cause: normalizeErrorCause(error),
        idempotencyKey: request.idempotencyKey,
      });
      throw new Error("Booking service failed");
    }
  }

  private async createBookingInternal(request: BookingRequestDto): Promise<BookingServiceResult> {
    this.logger.info("booking.start", { idempotencyKey: request.idempotencyKey });
    const existing = await this.bookingRepository.findByIdempotencyKey(request.idempotencyKey);

    if (existing) {
      return this.handleReplay(existing, request);
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
      return this.handleReplay(reservation.record, request);
    }

    await this.processPendingProviders(reservation.record);

    this.logger.info("booking.accepted", { bookingId: reservation.record.id });
    return response;
  }

  private async handleReplay(record: BookingRecord, request: BookingRequestDto): Promise<BookingServiceResult> {
    if (record.payloadHash !== createBookingPayloadHash(request)) {
      this.logger.warn("booking.idempotency_conflict", { bookingId: record.id });
      return this.error(MEETING_ERROR_CODES.IDEMPOTENCY_CONFLICT);
    }

    const replay = (await this.bookingRepository.recordIdempotencyReplay(record.id)) ?? record;

    if (this.areProvidersComplete(replay)) {
      this.logger.info("booking.replay.cached", { bookingId: replay.id });
      return this.success(replay.id);
    }

    await this.processPendingProviders(replay);
    this.logger.info("booking.replay.recoverable", { bookingId: replay.id });
    return this.success(replay.id);
  }

  private areProvidersComplete(record: BookingRecord) {
    return record.calendarDelivery.status === "completed" && record.emailDelivery.status === "completed";
  }

  private async processPendingProviders(record: BookingRecord) {
    let currentRecord = record;

    if (currentRecord.calendarDelivery.status !== "completed") {
      try {
        const result = await this.calendarProvider.createEvent(currentRecord);

        if (result.success) {
          currentRecord = (await this.bookingRepository.updateProviderDetails(currentRecord.id, result.event)) ?? currentRecord;
        } else {
          currentRecord = (await this.bookingRepository.updateProviderDelivery(currentRecord.id, "calendar", {
            errorCode: result.error,
            status: "failed",
          })) ?? currentRecord;
          this.logger.warn("booking.provider_failed", { bookingId: currentRecord.id, code: result.error, provider: "calendar" });
        }
      } catch (error) {
        currentRecord = (await this.bookingRepository.updateProviderDelivery(currentRecord.id, "calendar", {
          errorCode: "CALENDAR_PROVIDER_ERROR",
          status: "failed",
        })) ?? currentRecord;
        this.logger.error("booking.provider_unexpected_error", {
          bookingId: currentRecord.id,
          cause: normalizeErrorCause(error),
          provider: "calendar",
        });
      }
    }

    if (currentRecord.emailDelivery.status !== "completed") {
      try {
        const result = await this.emailProvider.sendMeetingRequested({
          booking: currentRecord,
          payload: { meetingId: currentRecord.id, status: currentRecord.status },
          recipient: currentRecord.identity.email,
        });

        if (result.success) {
          currentRecord = (await this.bookingRepository.updateProviderDelivery(currentRecord.id, "email", {
            status: "completed",
          })) ?? currentRecord;
        } else {
          currentRecord = (await this.bookingRepository.updateProviderDelivery(currentRecord.id, "email", {
            errorCode: result.error,
            status: "failed",
          })) ?? currentRecord;
          this.logger.warn("booking.provider_failed", { bookingId: currentRecord.id, code: result.error, provider: "email" });
        }
      } catch (error) {
        currentRecord = (await this.bookingRepository.updateProviderDelivery(currentRecord.id, "email", {
          errorCode: "EMAIL_PROVIDER_ERROR",
          status: "failed",
        })) ?? currentRecord;
        this.logger.error("booking.provider_unexpected_error", {
          bookingId: currentRecord.id,
          cause: normalizeErrorCause(error),
          provider: "email",
        });
      }
    }
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
