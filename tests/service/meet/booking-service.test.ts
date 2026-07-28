import { describe, expect, it } from "vitest";

import { ActionService } from "@/lib/meet/action-service";
import { MockActionTokenRepository } from "@/lib/meet/action-token-repository";
import type { AvailabilityQuery, AvailabilityRepository } from "@/lib/meet/availability-repository";
import { BookingService } from "@/lib/meet/booking-service";
import { createBookingRecord, type BookingRecord } from "@/lib/meet/booking-model";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import type { CalendarProvider, CalendarProviderResult } from "@/lib/meet/calendar-provider";
import { EMAIL_PROVIDER_ERROR_CODES, type EmailProvider, type EmailProviderResult, type EmailTemplateCode, type MeetingEmailInput } from "@/lib/meet/email-provider";
import type { MeetLogFields, MeetLogger } from "@/lib/meet/logger";
import type { Slot } from "@/lib/meet/domain";
import { createBookingRequest } from "../../helpers/booking-factory";
import { fixedClock } from "../../helpers/time";

const CLOCK = "2026-08-03T12:00:00.000Z";

class FixedAvailabilityRepository implements AvailabilityRepository {
  isAvailableDate(query: AvailabilityQuery) {
    void query;
    return true;
  }

  async getSlots(query: AvailabilityQuery): Promise<Slot[]> {
    void query;
    return [{ available: true, time: "10:00" }];
  }
}

class RecordingCalendarProvider implements CalendarProvider {
  createCalls = 0;
  deleteCalls = 0;
  updateCalls = 0;

  async createEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    this.createCalls += 1;
    return { success: true, event: { calendarEventId: `calendar-${booking.id}`, googleMeetUrl: "https://meet.google.com/mock" } };
  }

  async updateEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    this.updateCalls += 1;
    return { success: true, event: { calendarEventId: `calendar-${booking.id}`, googleMeetUrl: "https://meet.google.com/mock" } };
  }

  async deleteEvent(calendarEventId: string): Promise<CalendarProviderResult> {
    this.deleteCalls += 1;
    return { success: true, event: { calendarEventId, googleMeetUrl: "https://meet.google.com/mock" } };
  }
}

type EmailAttempt = {
  input: MeetingEmailInput;
  template: EmailTemplateCode;
};

class IdempotentSequencedEmailProvider implements EmailProvider {
  attempts: EmailAttempt[] = [];
  effectiveDeliveries: EmailAttempt[] = [];
  private readonly deliveredKeys = new Set<string>();
  private attemptIndex = 0;

  constructor(private readonly outcomes: readonly ("success" | "failure")[] = ["success"]) {}

  async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
    const attempt = { input, template };
    this.attempts.push(attempt);
    const outcome = this.outcomes[this.attemptIndex] ?? "success";
    this.attemptIndex += 1;
    if (outcome === "failure") {
      return { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR };
    }

    const key = input.idempotencyKey ?? `${template}:${input.recipient}`;
    if (!this.deliveredKeys.has(key)) {
      this.deliveredKeys.add(key);
      this.effectiveDeliveries.push(attempt);
    }
    return { success: true };
  }

  async sendMeetingRequested(input: MeetingEmailInput) { return this.send("MEETING_REQUESTED", input); }
  async sendMeetingConfirmed(input: MeetingEmailInput) { return this.send("MEETING_CONFIRMED", input); }
  async sendRescheduleProposed(input: MeetingEmailInput) { return this.send("RESCHEDULE_PROPOSED", input); }
}

class RecordingLogger implements MeetLogger {
  events: Array<{ event: string; fields?: MeetLogFields; level: "error" | "info" | "warn" }> = [];

  error(event: string, fields?: MeetLogFields) { this.events.push({ event, fields, level: "error" }); }
  info(event: string, fields?: MeetLogFields) { this.events.push({ event, fields, level: "info" }); }
  warn(event: string, fields?: MeetLogFields) { this.events.push({ event, fields, level: "warn" }); }
}

class FailTokenCreationRepository extends MockActionTokenRepository {
  failuresRemaining = 0;

  override async create(record: Parameters<MockActionTokenRepository["create"]>[0]) {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("token repository unavailable");
    }
    return super.create(record);
  }
}

function createHarness(options: {
  email?: IdempotentSequencedEmailProvider;
  tokenRepository?: MockActionTokenRepository;
} = {}) {
  const clock = fixedClock(CLOCK);
  const availability = new FixedAvailabilityRepository();
  const bookingRepository = new MockBookingRepository();
  const calendar = new RecordingCalendarProvider();
  const email = options.email ?? new IdempotentSequencedEmailProvider();
  const tokenRepository = options.tokenRepository ?? new MockActionTokenRepository();
  const logger = new RecordingLogger();
  const actionService = new ActionService(bookingRepository, availability, clock.now, tokenRepository, calendar, email);
  const bookingService = new BookingService(availability, bookingRepository, calendar, email, logger, actionService);

  return { actionService, bookingRepository, bookingService, calendar, email, logger, tokenRepository };
}

describe("BookingService direct provider coverage", () => {
  it("creates a requested booking with owner tokens while deferring Calendar and Meet creation", async () => {
    const harness = createHarness();
    const request = createBookingRequest();

    const result = await harness.bookingService.createBooking(request);
    const meetingId = result.success ? result.meetingId : "";
    const persisted = await harness.bookingRepository.findById(meetingId);

    expect(result).toMatchObject({ status: "requested", success: true });
    expect(persisted).toMatchObject({
      calendarDelivery: { attempts: 0, status: "pending" },
      calendarEventId: null,
      emailDelivery: { attempts: 1, status: "completed" },
      googleMeetUrl: null,
      status: "requested",
    });
    expect(await harness.tokenRepository.findByMeetingId(meetingId)).toHaveLength(3);
    expect(harness.calendar.createCalls).toBe(0);
    expect(harness.email.effectiveDeliveries).toHaveLength(2);
  });

  it("persists an initial owner email failure and recovers it without minting duplicate action tokens", async () => {
    const originalOwnerRecipient = process.env.CONTACT_TO_EMAIL;
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    const email = new IdempotentSequencedEmailProvider(["failure", "success", "success", "success"]);
    const harness = createHarness({ email });
    const request = createBookingRequest();

    try {
      const created = await harness.bookingService.createBooking(request);
      const persistedAfterFailure = await harness.bookingRepository.findByIdempotencyKey(request.idempotencyKey);
      const meetingId = persistedAfterFailure?.id ?? "";
      expect(persistedAfterFailure).toMatchObject({
        emailDelivery: { attempts: 1, status: "failed" },
        status: "requested",
      });
      expect(created).toEqual({ error: "PROVIDER_UNAVAILABLE", success: false });
      expect(await harness.tokenRepository.findByMeetingId(meetingId)).toHaveLength(3);

      await expect(harness.bookingService.createBooking(request)).resolves.toMatchObject({ emailDeliveryStatus: "completed", meetingId, success: true });

      expect(await harness.bookingRepository.findById(meetingId)).toMatchObject({
        emailDelivery: { attempts: 2, status: "completed" },
      });
      expect(harness.email.attempts).toHaveLength(4);
      expect(harness.email.effectiveDeliveries).toHaveLength(2);
      expect(harness.email.attempts[0]?.input.idempotencyKey).toBe(harness.email.attempts[2]?.input.idempotencyKey);
      expect(await harness.tokenRepository.findByMeetingId(meetingId)).toHaveLength(3);
      expect(harness.calendar.createCalls).toBe(0);
    } finally {
      if (originalOwnerRecipient === undefined) delete process.env.CONTACT_TO_EMAIL;
      else process.env.CONTACT_TO_EMAIL = originalOwnerRecipient;
    }
  });

  it("short-circuits completed delivery and non-requested calendar failures without provider effects", async () => {
    const harness = createHarness();
    const completedRequest = createBookingRequest();
    const completed = await harness.bookingService.createBooking(completedRequest);
    const completedMeetingId = completed.success ? completed.meetingId : "";
    const completedAttempts = harness.email.attempts.length;
    const completedTokens = await harness.tokenRepository.findByMeetingId(completedMeetingId);

    await harness.bookingService.createBooking(completedRequest);
    expect(harness.email.attempts).toHaveLength(completedAttempts);
    expect(await harness.tokenRepository.findByMeetingId(completedMeetingId)).toEqual(completedTokens);

    const failedCalendarRequest = createBookingRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000010" });
    const failedCalendarRecord = {
      ...createBookingRecord(failedCalendarRequest, { createdAt: CLOCK, id: "owner-confirmed-calendar-failure" }),
      calendarDelivery: { attempts: 1, status: "failed" as const },
      emailDelivery: { attempts: 1, status: "failed" as const },
      status: "owner_confirmed" as const,
    };
    await harness.bookingRepository.create(failedCalendarRecord);

    await harness.bookingService.createBooking(failedCalendarRequest);
    expect(harness.email.attempts).toHaveLength(completedAttempts);
    expect(harness.calendar.createCalls).toBe(0);
    expect(await harness.bookingRepository.findById(failedCalendarRecord.id)).toMatchObject({
      calendarDelivery: { attempts: 1, status: "failed" },
    });
  });

  it("keeps the requested booking when initial owner token issuance fails and recovers during provider processing", async () => {
    const tokenRepository = new FailTokenCreationRepository();
    tokenRepository.failuresRemaining = 1;
    const harness = createHarness({ tokenRepository });
    const request = createBookingRequest();

    const created = await harness.bookingService.createBooking(request);
    const meetingId = created.success ? created.meetingId : "";
    expect(await harness.bookingRepository.findById(meetingId)).toMatchObject({
      emailDelivery: { attempts: 1, status: "completed" },
      status: "requested",
    });
    expect(harness.logger.events.filter(({ event }) => event === "booking.action_tokens_issuance_failed")).toHaveLength(1);
    expect(await tokenRepository.findByMeetingId(meetingId)).toHaveLength(3);

    await harness.bookingService.createBooking(request);
    expect(await harness.bookingRepository.findById(meetingId)).toMatchObject({
      emailDelivery: { attempts: 1, status: "completed" },
    });
    expect(await tokenRepository.findByMeetingId(meetingId)).toHaveLength(3);
    expect(harness.calendar.createCalls).toBe(0);
  });

  it("propagates service context through the requested notification payloads", async () => {
    const harness = createHarness();
    const request = {
      ...createBookingRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000011" }),
      origin: "service" as const,
      previousRequest: { details: { goal: "launch", pages: 5 }, service: "landing" },
      relatedService: "landing",
    } as Parameters<BookingService["createBooking"]>[0];

    await expect(harness.bookingService.createBooking(request)).resolves.toMatchObject({ status: "requested", success: true });

    expect(harness.email.attempts).toHaveLength(2);
    expect(harness.email.attempts.map(({ input }) => input.booking)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        previousRequest: { details: { goal: "launch", pages: 5 }, service: "landing" },
        relatedService: "landing",
      }),
    ]));
  });
});
