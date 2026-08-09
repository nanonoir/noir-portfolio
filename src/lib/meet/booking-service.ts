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
import {
  ActionService,
  issueOwnerTokensForNewBooking,
} from "./action-service";
import { sendInitialRequestNotifications } from "./email-notifications";
import type { IssuedActionToken } from "./action-tokens";
import { sealInitialOwnerTokens, unsealInitialOwnerTokens } from "./initial-owner-notification-recovery";
import { FreeBusyError } from "@/lib/server/google-calendar-freebusy";

export type BookingServiceResult = BookingSuccessResponseDto | BookingErrorResponseDto;

export class BookingService {
  constructor(
    private readonly availabilityRepository: AvailabilityRepository = new MockAvailabilityRepository(),
    private readonly bookingRepository: BookingRepository = new MockBookingRepository(),
    private readonly calendarProvider: CalendarProvider = new GoogleCalendarMockProvider(),
    private readonly emailProvider: EmailProvider = new ResendMockProvider(),
    private readonly logger: MeetLogger = new NoopMeetLogger(),
    private readonly actionService?: ActionService,
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

    let slotAvailable: boolean;
    try {
      slotAvailable = await this.isSlotAvailable(request);
    } catch (error) {
      if (isRetryableFreeBusyProviderFailure(error)) {
        this.logger.error("booking.availability_provider_unavailable", {
          cause: normalizeErrorCause(error),
          idempotencyKey: request.idempotencyKey,
          provider: "calendar",
        });
        return this.error(MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE);
      }
      throw error;
    }

    if (!slotAvailable) {
      return this.error(MEETING_ERROR_CODES.SLOT_UNAVAILABLE);
    }

    // Requested bookings persist without reservations or Calendar events.
    const response = this.success(`meet_${crypto.randomUUID().slice(0, 8)}`);
    const createdRecord = createBookingRecord(request, { id: response.meetingId });
    const persistedRecord = await this.bookingRepository.create(createdRecord);
    if (persistedRecord.id !== createdRecord.id) {
      return this.handleReplay(persistedRecord, request);
    }

    // Raw tokens are used only to compose owner links; hashes are persisted.
    // The encrypted recovery envelope lets retries reuse the same token set.
    let ownerTokens: IssuedActionToken[] = [];
    if (this.actionService) {
      try {
        ownerTokens = await issueOwnerTokensForNewBooking(this.actionService, createdRecord);
      } catch (error) {
        this.logger.error("booking.action_tokens_issuance_failed", {
          bookingId: createdRecord.id,
          cause: normalizeErrorCause(error),
        });
      }
    }

    // Requested bookings send owner actions and a visitor receipt.
    const deliveredRecord = await this.processPendingProviders(createdRecord, ownerTokens);

    this.logger.info("booking.accepted", { bookingId: createdRecord.id });
    if (deliveredRecord.emailDelivery.status !== "completed") {
      return this.error(MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE);
    }
    return this.success(response.meetingId, deliveredRecord.emailDelivery.status);
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

    const deliveredRecord = await this.processPendingProviders(replay);
    this.logger.info("booking.replay.recoverable", { bookingId: replay.id });
    if (deliveredRecord.emailDelivery.status !== "completed") {
      return this.error(MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE);
    }
    return this.success(replay.id, deliveredRecord.emailDelivery.status);
  }

  private areProvidersComplete(record: BookingRecord) {
    // Requested bookings do not require Calendar delivery until confirmation.
    const calendarRequired = record.status === "owner_confirmed" || record.status === "confirmed";
    return (!calendarRequired || record.calendarDelivery.status === "completed") &&
      record.emailDelivery.status === "completed";
  }

  private async processPendingProviders(
    record: BookingRecord,
    initialOwnerTokens?: readonly IssuedActionToken[],
  ): Promise<BookingRecord> {
    // The request path sends initial email only; Calendar starts after confirmation.
    if (record.status !== "requested" || record.emailDelivery.status === "completed") {
      return record;
    }

    let ownerTokens = initialOwnerTokens ?? [];
    if (ownerTokens.length > 0) {
      const recovery = sealInitialOwnerTokens(ownerTokens);
      await this.bookingRepository.updateOwnerNotificationRecovery(record.id, recovery);
    }
    if (ownerTokens.length === 0 && this.actionService) {
      ownerTokens = unsealInitialOwnerTokens(record.ownerNotificationRecovery) ?? [];
      // No envelope means issuance never completed; mint the initial set once.
      // A persisted envelope is always preferred so an owner-email retry never
      // creates additional valid action tokens.
      if (ownerTokens.length === 0 && record.ownerNotificationRecovery === null) {
        try {
          ownerTokens = await issueOwnerTokensForNewBooking(this.actionService, record);
          const recovery = sealInitialOwnerTokens(ownerTokens);
          await this.bookingRepository.updateOwnerNotificationRecovery(record.id, recovery);
        } catch (error) {
          this.logger.error("booking.action_tokens_issuance_failed", {
            bookingId: record.id,
            cause: normalizeErrorCause(error),
          });
        }
      }
    }

    try {
      const delivered = await sendInitialRequestNotifications(
        this.emailProvider,
        this.bookingRepository,
        record,
        ownerTokens,
      );
      if (delivered.emailDelivery.status === "completed") {
        return (await this.bookingRepository.updateOwnerNotificationRecovery(record.id, null)) ?? delivered;
      }
      return delivered;
    } catch (error) {
      this.logger.error("booking.provider_unexpected_error", {
        bookingId: record.id,
        cause: normalizeErrorCause(error),
        provider: "email",
      });
      return (await this.bookingRepository.updateProviderDelivery(record.id, "email", {
        errorCode: "EMAIL_PROVIDER_ERROR",
        status: "failed",
      })) ?? record;
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

  private error(error: BookingErrorResponseDto["error"]): BookingServiceResult {
    return { success: false, error };
  }

  private success(
    meetingId: string,
    emailDeliveryStatus: BookingSuccessResponseDto["emailDeliveryStatus"] = "pending",
  ): BookingSuccessResponseDto {
    return {
      success: true,
      code: MEETING_RESPONSE_CODES.REQUEST_ACCEPTED,
      meetingId,
      status: "requested",
      emailDeliveryStatus,
    };
  }
}

function isRetryableFreeBusyProviderFailure(error: unknown): boolean {
  return error instanceof FreeBusyError && error.code === "FREEBUSY_PROVIDER_ERROR";
}
