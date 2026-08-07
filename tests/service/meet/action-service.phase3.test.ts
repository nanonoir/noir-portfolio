import { describe, expect, it } from "vitest";

import { ActionService } from "@/lib/meet/action-service";
import { ACTION_TOKEN_ACTIONS, ACTION_TOKEN_ACTORS, type ActionTokenAction, type ActionTokenActor } from "@/lib/meet/action-tokens";
import { MockActionTokenRepository } from "@/lib/meet/action-token-repository";
import type { AvailabilityQuery, AvailabilityRepository } from "@/lib/meet/availability-repository";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import { BookingService } from "@/lib/meet/booking-service";
import type { BookingRecord } from "@/lib/meet/booking-model";
import type { CalendarProvider, CalendarProviderResult } from "@/lib/meet/calendar-provider";
import { CALENDAR_PROVIDER_ERROR_CODES } from "@/lib/meet/calendar-provider";
import type { EmailProvider, EmailProviderResult, EmailTemplateCode, MeetingEmailInput } from "@/lib/meet/email-provider";
import { EMAIL_PROVIDER_ERROR_CODES } from "@/lib/meet/email-provider";
import { MEETING_ERROR_CODES } from "@/lib/meet/codes";
import type { Slot, Timezone } from "@/lib/meet/domain";
import { fixedClock } from "../../helpers/time";
import { createBookingRecordFixture, createBookingRequest } from "../../helpers/booking-factory";

const CLOCK = "2026-08-03T12:00:00.000Z";
const UTC_TIMEZONE = "UTC" as Timezone;

class FixedAvailabilityRepository implements AvailabilityRepository {
  isAvailableDate() {
    return true;
  }

  async getSlots(query: AvailabilityQuery): Promise<Slot[]> {
    void query;

    return [
      { available: true, time: "10:00" },
      { available: true, time: "11:00" },
      { available: true, time: "12:00" },
    ];
  }
}

class SequencedCalendarProvider implements CalendarProvider {
  createCalls = 0;
  deleteCalls = 0;
  updateCalls = 0;

  constructor(private readonly outcomes: readonly ("success" | "failure" | "timeout")[] = ["success"]) {}

  async createEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    this.createCalls += 1;
    return this.result(this.outcomes[this.createCalls - 1] ?? "success", booking);
  }

  async updateEvent(booking: BookingRecord): Promise<CalendarProviderResult> {
    this.updateCalls += 1;
    return this.result(this.outcomes[this.updateCalls - 1] ?? "success", booking);
  }

  async deleteEvent(calendarEventId: string): Promise<CalendarProviderResult> {
    this.deleteCalls += 1;
    return { success: true, event: { calendarEventId, googleMeetUrl: "https://meet.google.com/mock" } };
  }

  private result(outcome: "success" | "failure" | "timeout", booking: BookingRecord): CalendarProviderResult {
    if (outcome === "timeout") {
      throw new Error("provider timeout");
    }
    if (outcome === "failure") {
      return { success: false, error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR };
    }
    return {
      success: true,
      event: { calendarEventId: `calendar-${booking.id}`, googleMeetUrl: `https://meet.google.com/${booking.id}` },
    };
  }
}

class SequencedEmailProvider implements EmailProvider {
  calls: Array<{ template: EmailTemplateCode; input: MeetingEmailInput }> = [];
  private callIndex = 0;

  constructor(private readonly outcomes: readonly ("success" | "failure" | "timeout" | "throw")[] = ["success"]) {}

  async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
    this.calls.push({ template, input });
    const outcome = this.outcomes[this.callIndex] ?? "success";
    this.callIndex += 1;
    if (outcome === "throw") {
      throw new Error("Resend transport unavailable");
    }
    // Production providers convert their timeout boundary into the same stable
    // provider error contract; the service must recover that state on replay.
    return outcome === "success"
      ? { success: true }
      : { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR };
  }

  async sendMeetingRequested(input: MeetingEmailInput) { return this.send("MEETING_REQUESTED", input); }
  async sendMeetingConfirmed(input: MeetingEmailInput) { return this.send("MEETING_CONFIRMED", input); }
  async sendRescheduleProposed(input: MeetingEmailInput) { return this.send("RESCHEDULE_PROPOSED", input); }
}

class FailOnceCreateTokenRepository extends MockActionTokenRepository {
  failNextCreate = false;

  override async create(record: Parameters<MockActionTokenRepository["create"]>[0]) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error("token repository unavailable");
    }
    return super.create(record);
  }
}

class FailOnceReservationBookingRepository extends MockBookingRepository {
  failNextReservation = false;

  override async reserveSlotForMeeting(input: Parameters<MockBookingRepository["reserveSlotForMeeting"]>[0]) {
    if (this.failNextReservation) {
      this.failNextReservation = false;
      throw new Error("booking repository unavailable");
    }
    return super.reserveSlotForMeeting(input);
  }
}

function createHarness(options: {
  calendar?: CalendarProvider;
  email?: EmailProvider;
  repository?: MockBookingRepository;
} = {}) {
  const clock = fixedClock(CLOCK);
  const bookingRepository = options.repository ?? new MockBookingRepository();
  const tokenRepository = new MockActionTokenRepository();
  const calendar = options.calendar ?? new SequencedCalendarProvider();
  const email = options.email ?? new SequencedEmailProvider();
  const actionService = new ActionService(
    bookingRepository,
    new FixedAvailabilityRepository(),
    clock.now,
    tokenRepository,
    calendar,
    email,
  );
  return { actionService, bookingRepository, calendar, clock, email, tokenRepository };
}

async function issue(
  service: ActionService,
  meetingId: string,
  actor: ActionTokenActor,
  action: ActionTokenAction,
  proposalVersion = "1",
) {
  return (await service.issueTokens({
    actions: [action],
    actor,
    meetingId,
    proposalVersion,
    proposedSlotStartISO: "2026-08-05T11:00:00.000Z",
  }))[0]!;
}

async function reserveCurrentSlot(repository: MockBookingRepository, booking: BookingRecord) {
  return repository.reserveSlotForMeeting({
    meetingId: booking.id,
    slotIdentity: "2026-08-04T10:00:00.000Z" as never,
    toStatus: "owner_confirmed",
  });
}

describe("Phase 3 mocked Meet service flows", () => {
  it("issues owner actions when a visitor proposes and preserves service context in the notification", async () => {
    const email = new SequencedEmailProvider();
    const harness = createHarness({ email });
    const booking = {
      ...createBookingRecordFixture(),
      origin: "service" as const,
      previousRequest: { details: { pages: 5, goal: "launch" }, service: "landing" },
      reason: null,
      relatedService: "landing",
    };
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.VISITOR, ACTION_TOKEN_ACTIONS.PROPOSE);

    const result = await harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.PROPOSE,
      meetingId: booking.id,
      payload: { proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: UTC_TIMEZONE } },
      rawToken: token.token,
    });

    expect(result).toMatchObject({ status: "ok", meeting: { status: "reschedule_proposed" } });
    expect(result.issuedTokens?.map(({ record }) => `${record.actor}:${record.action}`)).toEqual([
      "owner:confirm", "owner:propose", "owner:decline",
    ]);
    expect(email.calls).toHaveLength(1);
    expect(email.calls[0]).toMatchObject({
      input: { booking: { previousRequest: { service: "landing" }, relatedService: "landing" } },
      template: "RESCHEDULE_PROPOSED",
    });
  });

  it("accepts a visitor proposal, moves the reservation, and releases the prior slot", async () => {
    const harness = createHarness();
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    expect(await reserveCurrentSlot(harness.bookingRepository, booking)).toMatchObject({ success: true });
    const ownerToken = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.PROPOSE);
    const proposal = await harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.PROPOSE,
      meetingId: booking.id,
      payload: { proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: UTC_TIMEZONE } },
      rawToken: ownerToken.token,
    });
    const acceptToken = (proposal.issuedTokens ?? []).find(({ record }) => record.action === ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL);
    expect(acceptToken).toBeDefined();
    if (!acceptToken) {
      throw new Error("Expected an accept-proposal token");
    }

    const accepted = await harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL,
      meetingId: booking.id,
      rawToken: acceptToken.token,
    });
    const replacement = createBookingRecordFixture({ id: "replacement", idempotencyKey: "00000000-0000-4000-8000-000000000002" });
    await harness.bookingRepository.create(replacement);

    expect(accepted).toMatchObject({ status: "ok", meeting: { meeting: { date: "2026-08-05", time: "11:00" }, status: "owner_confirmed" } });
    expect(accepted.meeting?.auditLog).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({ action: "accept_proposal" }),
      timestamp: CLOCK,
    }));
    expect(await reserveCurrentSlot(harness.bookingRepository, replacement)).toMatchObject({ success: true });
  });

  it("rejects a visitor proposal acceptance when its proposed slot is already reserved", async () => {
    const harness = createHarness();
    const booking = createBookingRecordFixture();
    const competitor = createBookingRecordFixture({ id: "competitor", idempotencyKey: "00000000-0000-4000-8000-000000000003", meetingDate: "2026-08-05", meetingTime: "11:00" });
    await harness.bookingRepository.create(booking);
    await harness.bookingRepository.create(competitor);
    expect(await harness.bookingRepository.reserveSlotForMeeting({ meetingId: competitor.id, slotIdentity: "2026-08-05T11:00:00.000Z" as never, toStatus: "owner_confirmed" })).toMatchObject({ success: true });
    const ownerToken = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.PROPOSE);
    const proposal = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.PROPOSE, meetingId: booking.id, payload: { proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: UTC_TIMEZONE } }, rawToken: ownerToken.token });
    const acceptToken = (proposal.issuedTokens ?? []).find(({ record }) => record.action === ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL);
    expect(acceptToken).toBeDefined();
    if (!acceptToken) {
      throw new Error("Expected an accept-proposal token");
    }

    await expect(harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL, meetingId: booking.id, rawToken: acceptToken.token }))
      .resolves.toMatchObject({ error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, status: "slot_unavailable" });
  });

  it("keeps an accept-proposal link inactive when no proposed slot exists", async () => {
    const harness = createHarness();
    const booking = {
      ...createBookingRecordFixture(),
      expiresAt: null,
      proposalVersion: "2",
      proposedSlot: null,
      status: "reschedule_proposed" as const,
    };
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.VISITOR, ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL, "2");

    await expect(harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL, meetingId: booking.id, rawToken: token.token }))
      .resolves.toMatchObject({ error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE, status: "rejected" });
  });

  it("records owner and visitor declines, releases reservations, and cancels a visitor-declined calendar event", async () => {
    const calendar = new SequencedCalendarProvider();
    const email = new SequencedEmailProvider();
    const harness = createHarness({ calendar, email });
    const ownerDeclined = createBookingRecordFixture({ id: "owner-decline", idempotencyKey: "00000000-0000-4000-8000-000000000004" });
    await harness.bookingRepository.create(ownerDeclined);
    const ownerToken = await issue(harness.actionService, ownerDeclined.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.DECLINE);
    const ownerResult = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.DECLINE, meetingId: ownerDeclined.id, payload: { reason: "not a fit" }, rawToken: ownerToken.token });

    const visitorDeclined = createBookingRecordFixture({ id: "visitor-decline", idempotencyKey: "00000000-0000-4000-8000-000000000005" });
    await harness.bookingRepository.create(visitorDeclined);
    const confirmed = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: visitorDeclined.id, rawToken: (await issue(harness.actionService, visitorDeclined.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM)).token });
    const visitorToken = (confirmed.issuedTokens ?? []).find(({ record }) => record.action === ACTION_TOKEN_ACTIONS.DECLINE);
    expect(visitorToken).toBeDefined();
    if (!visitorToken) {
      throw new Error("Expected a visitor decline token");
    }
    const visitorResult = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.DECLINE, meetingId: visitorDeclined.id, rawToken: visitorToken.token });

    expect(ownerResult.meeting?.auditLog.at(-1)?.payload).toMatchObject({ reason: "not a fit" });
    expect(ownerResult.meeting?.status).toBe("declined");
    expect(visitorResult.meeting?.status).toBe("declined");
    expect(calendar.deleteCalls).toBe(1);
    expect(email.calls.filter(({ template }) => template === "MEETING_DECLINED")).toHaveLength(2);
  });

  it("keeps a declined meeting authoritative when Resend throws, then retries only email on token replay", async () => {
    const calendar = new SequencedCalendarProvider();
    const email = new SequencedEmailProvider(["throw", "success"]);
    const harness = createHarness({ calendar, email });
    const booking = createBookingRecordFixture({
      id: "decline-email-recovery",
      idempotencyKey: "00000000-0000-4000-8000-000000000010",
    });
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.DECLINE);

    const first = await harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.DECLINE,
      meetingId: booking.id,
      rawToken: token.token,
    });
    const replay = await harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.DECLINE,
      meetingId: booking.id,
      rawToken: token.token,
    });

    expect(first).toMatchObject({
      status: "ok",
      meeting: { status: "declined", emailDelivery: { status: "failed" } },
    });
    expect(replay).toMatchObject({
      status: "replayed",
      meeting: { status: "declined", emailDelivery: { attempts: 2, status: "completed" } },
    });
    expect(calendar.deleteCalls).toBe(0);
    expect(email.calls).toHaveLength(2);
  });

  it("returns a retryable pending outcome for calendar failure, then recovers only the calendar on replay", async () => {
    const calendar = new SequencedCalendarProvider(["failure", "success"]);
    const harness = createHarness({ calendar });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    const first = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });
    const replay = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });

    expect(first).toMatchObject({ error: "PROVIDER_UNAVAILABLE", meeting: { calendarDelivery: { status: "failed" }, status: "owner_confirmed" }, status: "pending" });
    expect(replay).toMatchObject({ meeting: { calendarDelivery: { attempts: 2, status: "completed" }, status: "owner_confirmed" }, status: "replayed" });
    expect(calendar.createCalls).toBe(2);
    expect(await harness.tokenRepository.findByMeetingId(booking.id)).toHaveLength(3);
    expect(replay.meeting?.auditLog.map(({ action }) => action)).toEqual(expect.arrayContaining(["provider_failed", "provider_recovered"]));

    const timeoutHarness = createHarness({ calendar: new SequencedCalendarProvider(["timeout"]) });
    const timedOutBooking = createBookingRecordFixture({ id: "calendar-timeout", idempotencyKey: "00000000-0000-4000-8000-000000000006" });
    await timeoutHarness.bookingRepository.create(timedOutBooking);
    const timeoutResult = await timeoutHarness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: timedOutBooking.id, rawToken: (await issue(timeoutHarness.actionService, timedOutBooking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM)).token });
    expect(timeoutResult).toMatchObject({ error: "PROVIDER_UNAVAILABLE", meeting: { calendarDelivery: { status: "failed" }, status: "owner_confirmed" }, status: "pending" });
  });

  it("recovers failed email delivery on replay without recreating the calendar event", async () => {
    const calendar = new SequencedCalendarProvider();
    const email = new SequencedEmailProvider(["failure", "success"]);
    const harness = createHarness({ calendar, email });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);

    const first = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });
    const replay = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });

    expect(first).toMatchObject({ status: "ok", meeting: { calendarDelivery: { status: "completed" }, emailDelivery: { status: "failed" }, status: "owner_confirmed" } });
    expect(replay).toMatchObject({ meeting: { calendarDelivery: { attempts: 1, status: "completed" }, emailDelivery: { attempts: 2, status: "completed" } }, status: "replayed" });
    expect(calendar.createCalls).toBe(1);
    expect(email.calls).toHaveLength(2);
  });

  it("persists a timed-out Resend delivery as failed and recovers it with the same replay boundary", async () => {
    const email = new SequencedEmailProvider(["timeout", "success"]);
    const harness = createHarness({ email });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);

    const first = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });
    const replay = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });

    expect(first).toMatchObject({ meeting: { emailDelivery: { status: "failed" } } });
    expect(replay).toMatchObject({ meeting: { emailDelivery: { attempts: 2, status: "completed" } }, status: "replayed" });
  });

  it("allows exactly one concurrent token claimant and prevents duplicate provider effects", async () => {
    const calendar = new SequencedCalendarProvider();
    const harness = createHarness({ calendar });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);

    const [left, right] = await Promise.all([
      harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token }),
      harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token }),
    ]);

    expect([left.status, right.status].sort()).toEqual(["ok", "rejected"]);
    expect(calendar.createCalls).toBe(1);
    expect((await harness.tokenRepository.findByMeetingId(booking.id)).filter(({ usedAt }) => usedAt)).toHaveLength(1);
  });

  it("reclaims an uncommitted stale processing lease and executes the action once", async () => {
    const calendar = new SequencedCalendarProvider();
    const harness = createHarness({ calendar });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    await harness.tokenRepository.markUsed(booking.id, token.record.id, {
      usedAt: "2026-08-03T10:00:00.000Z",
      processingStartedAt: "2026-08-03T10:00:00.000Z",
      processingOwnerNonce: "timed-out-owner",
    });

    await expect(harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).resolves.toMatchObject({ status: "ok", meeting: { status: "owner_confirmed" } });
    expect(calendar.createCalls).toBe(1);
    expect(await harness.tokenRepository.findByTokenHash(booking.id, token.record.tokenHash)).toMatchObject({
      processingOwnerNonce: null,
      processingStartedAt: null,
      result: { status: "ok" },
    });
  });

  it("replays a committed processing action without duplicate Calendar or Resend effects", async () => {
    const calendar = new SequencedCalendarProvider();
    const email = new SequencedEmailProvider();
    const harness = createHarness({ calendar, email });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    await reserveCurrentSlot(harness.bookingRepository, booking);
    await harness.tokenRepository.markUsed(booking.id, token.record.id, {
      usedAt: CLOCK,
      processingStartedAt: CLOCK,
      processingOwnerNonce: "timed-out-owner",
    });

    await expect(harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).resolves.toMatchObject({ status: "replayed", meeting: { status: "owner_confirmed" } });
    expect(calendar.createCalls).toBe(0);
    expect(email.calls).toHaveLength(0);
  });

  it("rejects an active processing lease instead of reporting action success", async () => {
    const calendar = new SequencedCalendarProvider();
    const harness = createHarness({ calendar });
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    await harness.tokenRepository.markUsed(booking.id, token.record.id, {
      usedAt: CLOCK,
      processingStartedAt: CLOCK,
      processingOwnerNonce: "active-owner",
    });

    await expect(harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).resolves.toMatchObject({
      error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE,
      status: "rejected",
    });
    expect(calendar.createCalls).toBe(0);
  });

  it("releases only an uncommitted claim after an unexpected execution failure", async () => {
    const repository = new FailOnceReservationBookingRepository();
    const calendar = new SequencedCalendarProvider();
    const harness = createHarness({ calendar, repository });
    const booking = createBookingRecordFixture();
    await repository.create(booking);
    const token = await issue(harness.actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    repository.failNextReservation = true;

    await expect(harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).rejects.toThrow("booking repository unavailable");

    expect(await harness.tokenRepository.findByTokenHash(booking.id, token.record.tokenHash)).toMatchObject({
      result: null,
      usedAt: null,
    });

    await expect(harness.actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).resolves.toMatchObject({ status: "ok" });
    expect(calendar.createCalls).toBe(1);
  });

  it("finalizes a committed claim after token issuance fails without duplicating provider effects on replay", async () => {
    const clock = fixedClock(CLOCK);
    const bookingRepository = new MockBookingRepository();
    const tokenRepository = new FailOnceCreateTokenRepository();
    const calendar = new SequencedCalendarProvider();
    const actionService = new ActionService(
      bookingRepository,
      new FixedAvailabilityRepository(),
      clock.now,
      tokenRepository,
      calendar,
      new SequencedEmailProvider(),
    );
    const booking = createBookingRecordFixture();
    await bookingRepository.create(booking);
    const token = await issue(actionService, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    tokenRepository.failNextCreate = true;

    await expect(actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).rejects.toThrow("token repository unavailable");

    expect(await tokenRepository.findByTokenHash(booking.id, token.record.tokenHash)).toMatchObject({
      result: { status: "ok" },
      usedAt: CLOCK,
    });

    await expect(actionService.consumeAction({
      expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM,
      meetingId: booking.id,
      rawToken: token.token,
    })).resolves.toMatchObject({ status: "replayed" });
    expect(calendar.createCalls).toBe(1);
  });

  it("allows one of two concurrent slot confirmations and rejects the conflicting meeting", async () => {
    const harness = createHarness();
    const first = createBookingRecordFixture({ id: "slot-first", idempotencyKey: "00000000-0000-4000-8000-000000000007" });
    const second = createBookingRecordFixture({ id: "slot-second", idempotencyKey: "00000000-0000-4000-8000-000000000008" });
    await harness.bookingRepository.create(first);
    await harness.bookingRepository.create(second);
    const firstToken = await issue(harness.actionService, first.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    const secondToken = await issue(harness.actionService, second.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);

    const results = await Promise.all([
      harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: first.id, rawToken: firstToken.token }),
      harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: second.id, rawToken: secondToken.token }),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual(["ok", "slot_unavailable"]);
  });

  it("creates requested bookings with pending calendar delivery, recovers email on retry, and enforces idempotency", async () => {
    const originalOwnerRecipient = process.env.CONTACT_TO_EMAIL;
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    const clock = fixedClock(CLOCK);
    const repository = new MockBookingRepository();
    const calendar = new SequencedCalendarProvider();
    const email = new SequencedEmailProvider(["failure", "failure", "success", "success"]);
    const actionService = new ActionService(repository, new FixedAvailabilityRepository(), clock.now, new MockActionTokenRepository(), calendar, email);
    const service = new BookingService(new FixedAvailabilityRepository(), repository, calendar, email, undefined, actionService);
    const request = createBookingRequest();

    try {
      const created = await service.createBooking(request);
      const replay = await service.createBooking(request);
      const conflictingReplay = await service.createBooking({ ...request, identity: { ...request.identity, name: "Different visitor" } });
      const persisted = await repository.findByIdempotencyKey(request.idempotencyKey);

      expect(created).toEqual({ error: MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE, success: false });
      expect(replay).toMatchObject({ meetingId: persisted?.id, success: true });
      expect(conflictingReplay).toEqual({ error: MEETING_ERROR_CODES.IDEMPOTENCY_CONFLICT, success: false });
      expect(persisted).toMatchObject({ calendarDelivery: { attempts: 0, status: "pending" }, emailDelivery: { status: "completed" }, status: "requested" });
      expect(calendar.createCalls).toBe(0);
    } finally {
      if (originalOwnerRecipient === undefined) delete process.env.CONTACT_TO_EMAIL;
      else process.env.CONTACT_TO_EMAIL = originalOwnerRecipient;
    }
  });

  it("returns SLOT_UNAVAILABLE before creating a booking when availability rejects the requested slot", async () => {
    const unavailable: AvailabilityRepository = {
      isAvailableDate: () => false,
      getSlots: async () => [],
    };
    const repository = new MockBookingRepository();
    const service = new BookingService(unavailable, repository);

    await expect(service.createBooking(createBookingRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000009" })))
      .resolves.toEqual({ error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, success: false });
    await expect(repository.findByIdempotencyKey("00000000-0000-4000-8000-000000000009")).resolves.toBeNull();
  });
});
