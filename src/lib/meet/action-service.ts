import "server-only";

import {
  ACTION_TOKEN_ACTORS,
  type ActionTokenActor,
  type ActionTokenRecord,
  type IssuedActionToken,
  computeTokenExpiry,
  generateRawToken,
  hashToken,
  isActionAllowedForActor,
  isTokenExpired,
} from "./action-tokens";
import { ACTION_TOKEN_ACTIONS, type ActionTokenAction } from "./action-contract";
import type { ActionTokenRepository } from "./action-token-repository";
import {
  BOOKING_AUDIT_ACTORS,
  type BookingAuditActor,
} from "./audit-events";
import {
  BOOKING_LIFECYCLE_ERROR_CODES,
} from "./booking-lifecycle";
import type { BookingRecord, BookingProposedSlotInput } from "./booking-model";
import type { AvailabilityRepository } from "./availability-repository";
import {
  type BookingRepository,
  BOOKING_REPOSITORY_ERROR_CODES,
} from "./booking-repository";
import {
  GoogleCalendarMockProvider,
  type CalendarProvider,
  type CalendarProviderSuccess,
  type CalendarProviderFailure,
} from "./calendar-provider";
import { CALENDAR_PROVIDER_ERROR_CODES } from "./calendar-provider";
import { MEETING_ERROR_CODES } from "./codes";
import type { MeetingStatus, SlotIdentity } from "./domain";
import { getSlotIdentity } from "./slot-identity";
import { meetLogger, normalizeErrorCause } from "./logger";
import {
  authoritativeFreeBusyRecheck,
  type AuthoritativeRecheckResult,
} from "@/lib/server/freebusy-recheck";
import {
  recordCalendarEventAudit,
  type CalendarEventAuditAction,
} from "@/lib/server/calendar-event-audit";
import type { EmailProvider } from "./email-provider";
import {
  sendCancelledNotice,
  sendConfirmationNotifications,
  sendDeclinedNotice,
  sendOwnerDeclinedNotice,
  sendOwnerRescheduleProposal,
  sendRescheduleProposal,
} from "./email-notifications";

/** Server-only token lifecycle; raw tokens never enter logs or persistence. */

export type ActionResultStatus =
  | "ok"
  | "pending"
  | "replayed"
  | "rejected"
  | "not_found"
  | "slot_unavailable"
  | "invalid_transition";

export interface ActionResult {
  status: ActionResultStatus;
  meeting?: BookingRecord;
  error?:
    | typeof MEETING_ERROR_CODES[keyof typeof MEETING_ERROR_CODES]
    | typeof BOOKING_LIFECYCLE_ERROR_CODES[keyof typeof BOOKING_LIFECYCLE_ERROR_CODES]
    | typeof BOOKING_REPOSITORY_ERROR_CODES[keyof typeof BOOKING_REPOSITORY_ERROR_CODES];
  /** Tokens issued for the next actor; raw values are reserved for email links. */
  issuedTokens?: IssuedActionToken[];
  /** Hash-only audit context for observability; never contains the raw token. */
  consumedTokenId?: string;
}

const ACTION_ALLOWED_CURRENT_STATUSES: Record<ActionTokenAction, ReadonlySet<MeetingStatus>> = {
  confirm: new Set<MeetingStatus>(["requested", "reschedule_proposed"]),
  propose: new Set<MeetingStatus>(["requested", "reschedule_proposed", "owner_confirmed"]),
  decline: new Set<MeetingStatus>(["requested", "reschedule_proposed", "owner_confirmed"]),
  accept_proposal: new Set<MeetingStatus>(["reschedule_proposed"]),
};

function isActionAllowedForStatus(action: ActionTokenAction, status: MeetingStatus): boolean {
  return ACTION_ALLOWED_CURRENT_STATUSES[action]?.has(status) ?? false;
}

function mapActorToAuditActor(actor: ActionTokenActor): BookingAuditActor {
  return actor === ACTION_TOKEN_ACTORS.OWNER ? BOOKING_AUDIT_ACTORS.TEAM : BOOKING_AUDIT_ACTORS.VISITOR;
}

type ProposalFollowUp = {
  actions: ActionTokenAction[];
  actor: ActionTokenActor;
};

function getProposalFollowUp(proposingActor: ActionTokenActor): ProposalFollowUp {
  if (proposingActor === ACTION_TOKEN_ACTORS.OWNER) {
    return {
      actor: ACTION_TOKEN_ACTORS.VISITOR,
      actions: [
        ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL,
        ACTION_TOKEN_ACTIONS.PROPOSE,
        ACTION_TOKEN_ACTIONS.DECLINE,
      ],
    };
  }

  return {
    actor: ACTION_TOKEN_ACTORS.OWNER,
    actions: [
      ACTION_TOKEN_ACTIONS.CONFIRM,
      ACTION_TOKEN_ACTIONS.PROPOSE,
      ACTION_TOKEN_ACTIONS.DECLINE,
    ],
  };
}

export interface IssueTokensInput {
  meetingId: string;
  actor: ActionTokenActor;
  actions: ActionTokenAction[];
  proposalVersion: string;
  proposedSlotStartISO: string | null;
}

function isActionProcessingResult(result: unknown): boolean {
  return typeof result === "object"
    && result !== null
    && "status" in result
    && result.status === "processing";
}

function isActionCommitted(
  action: ActionTokenAction,
  originalMeeting: BookingRecord,
  persistedMeeting: BookingRecord,
): boolean {
  switch (action) {
    case ACTION_TOKEN_ACTIONS.CONFIRM:
    case ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL:
      return persistedMeeting.status === "owner_confirmed";
    case ACTION_TOKEN_ACTIONS.PROPOSE:
      return persistedMeeting.status === "reschedule_proposed"
        && persistedMeeting.proposalVersion !== originalMeeting.proposalVersion;
    case ACTION_TOKEN_ACTIONS.DECLINE:
      return persistedMeeting.status === "declined";
  }
}

function isTokenActionCommitted(
  action: ActionTokenAction,
  token: ActionTokenRecord,
  persistedMeeting: BookingRecord,
): boolean {
  if (action === ACTION_TOKEN_ACTIONS.PROPOSE) {
    return persistedMeeting.status === "reschedule_proposed"
      && persistedMeeting.proposalVersion !== token.proposalVersion;
  }
  return isActionCommitted(action, persistedMeeting, persistedMeeting);
}

export class ActionService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly now: () => Date,
    private readonly tokenRepository: ActionTokenRepository,
    private readonly calendarProvider: CalendarProvider,
    private readonly emailProvider: EmailProvider,
  ) {
    if (
      !bookingRepository ||
      !availabilityRepository ||
      typeof now !== "function" ||
      !tokenRepository ||
      !calendarProvider ||
      !emailProvider
    ) {
      throw new Error("ActionService requires explicitly composed dependencies");
    }
  }

  /** Mints one actor's token set; raw tokens are returned only once. */
  async issueTokens(input: IssueTokensInput): Promise<IssuedActionToken[]> {
    const issuedAt = this.now();
    const issued: IssuedActionToken[] = [];

    for (const action of input.actions) {
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      // Proposal acceptance expires at the proposed slot; other actions use TTL.
      const expiresAt = computeTokenExpiry(
        action,
        issuedAt,
        input.proposedSlotStartISO,
      );

      const record: ActionTokenRecord = {
        id: crypto.randomUUID(),
        meetingId: input.meetingId,
        tokenHash,
        actor: input.actor,
        action,
        proposalVersion: input.proposalVersion,
        expiresAt,
        usedAt: null,
        result: null,
        processingStartedAt: null,
        processingOwnerNonce: null,
        createdAt: issuedAt.toISOString(),
      };
      await this.tokenRepository.create(record);
      issued.push({ token: rawToken, record });
    }

    return issued;
  }

  /** Validates a token without consuming it for GET confirmation pages. */
  async previewAction(params: {
    meetingId: string;
    rawToken: string;
    expectedAction: ActionTokenAction;
  }): Promise<{ ok: true; record: ActionTokenRecord; meeting: BookingRecord } | { ok: false; error: string }> {
    return this.validate(params);
  }

  /** Consumes a token idempotently and executes its action. */
  async consumeAction(params: {
    meetingId: string;
    rawToken: string;
    expectedAction: ActionTokenAction;
      /** Optional proposed slot or decline reason. */
    payload?: {
      proposedSlot?: BookingProposedSlotInput;
      reason?: string;
    };
  }): Promise<ActionResult> {
    const validation = await this.validate(params);
    if (!validation.ok) {
      return { status: "rejected", error: validation.error as never };
    }
    const { record: token, meeting } = validation;

      // A processing marker is reconciled through the lease claim below.
    if (token.usedAt !== null && token.result !== null && !isActionProcessingResult(token.result)) {
      const replayedMeeting = (await this.bookingRepository.findById(meeting.id)) ?? meeting;
      // Replays never repeat transitions; they may retry unfinished delivery.
      const recoveredMeeting =
        replayedMeeting.status === "owner_confirmed" &&
        replayedMeeting.calendarDelivery.status !== "completed"
          ? await this.createCalendarEventForBooking(
            replayedMeeting,
            replayedMeeting.calendarEventId ? "update" : "create",
          )
          : (replayedMeeting.status === "declined" || replayedMeeting.status === "cancelled") &&
              replayedMeeting.calendarDelivery.status !== "completed" &&
              replayedMeeting.calendarEventId
            ? await this.cancelCalendarEventForBooking(replayedMeeting)
            : replayedMeeting;
      const withRecoveredEmail =
        recoveredMeeting.emailDelivery.status !== "completed"
          ? await this.retryEmailDeliveryForAction(recoveredMeeting, token)
          : recoveredMeeting;
      return {
        status: "replayed",
        meeting: withRecoveredEmail,
        consumedTokenId: token.id,
      };
    }

    const claimTime = this.now().toISOString();
    const processingClaim = {
      usedAt: claimTime,
      processingStartedAt: claimTime,
      processingOwnerNonce: crypto.randomUUID(),
    };
    if (token.usedAt !== null && isActionProcessingResult(token.result)) {
      const persistedMeeting = (await this.bookingRepository.findById(meeting.id)) ?? meeting;
      if (isTokenActionCommitted(params.expectedAction, token, persistedMeeting) && token.processingOwnerNonce) {
        await this.tokenRepository.completeUse(meeting.id, token.id, {
          usedAt: token.usedAt,
          processingStartedAt: token.processingStartedAt ?? token.usedAt,
          processingOwnerNonce: token.processingOwnerNonce,
        }, { status: "ok", meetingId: persistedMeeting.id });
        return { status: "replayed", meeting: persistedMeeting, consumedTokenId: token.id };
      }
    }
    const claim = await this.tokenRepository.markUsed(meeting.id, token.id, processingClaim);
    if (!claim) {
      return { status: "rejected", error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
    if (!claim.claimed) {
      return { status: "rejected", error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE };
    }

      // Only the compare-and-set claimant executes; durable transitions stay consumed.
    let executed: ActionResult;
    try {
      executed = await this.executeAction({
        action: params.expectedAction,
        meeting,
        actor: token.actor,
        payload: params.payload,
        tokenHash: token.tokenHash,
        tokenId: token.id,
      });
    } catch (error) {
      try {
        const persistedMeeting = await this.bookingRepository.findById(meeting.id);
        if (persistedMeeting && isActionCommitted(params.expectedAction, meeting, persistedMeeting)) {
          await this.tokenRepository.completeUse(meeting.id, token.id, processingClaim, {
            status: "ok",
            meetingId: persistedMeeting.id,
          });
        } else if (persistedMeeting) {
          await this.tokenRepository.releaseUse(meeting.id, token.id, processingClaim);
        }
      } catch (reconciliationError) {
        meetLogger.error("action.token_reconciliation_failed", {
          bookingId: meeting.id,
          cause: normalizeErrorCause(reconciliationError),
        });
      }
      throw error;
    }

    if (executed.status === "ok" || executed.status === "pending" || executed.status === "replayed") {
      await this.tokenRepository.completeUse(meeting.id, token.id, processingClaim, {
        status: executed.status,
        meetingId: executed.meeting?.id ?? meeting.id,
      });
    } else {
      // Rejected transitions release the token for retry.
      await this.tokenRepository.releaseUse(meeting.id, token.id, processingClaim);
    }

    return executed;
  }

  async cancelMeeting(params: {
    meetingId: string;
    actor?: BookingAuditActor;
    reason?: string;
  }): Promise<ActionResult> {
    const meeting = await this.bookingRepository.findById(params.meetingId);
    if (!meeting) {
      return { status: "not_found", error: BOOKING_REPOSITORY_ERROR_CODES.BOOKING_NOT_FOUND };
    }

    const transition = await this.bookingRepository.updateStatus(meeting.id, "cancelled", {
      actor: params.actor ?? BOOKING_AUDIT_ACTORS.TEAM,
      payload: { action: "cancel", reason: params.reason },
    });
    if (!transition.success) {
      return { status: "invalid_transition", error: transition.error };
    }

    const cancelled = (transition as { record: BookingRecord }).record;
    const withCancelledCalendarEvent = meeting.calendarEventId
      ? await this.cancelCalendarEventForBooking(cancelled)
      : cancelled;
    const withCancelledEmail = await sendCancelledNotice(
      this.emailProvider,
      this.bookingRepository,
      withCancelledCalendarEvent,
    );
    return { status: "ok", meeting: withCancelledEmail, issuedTokens: [] };
  }

  private async validate(params: {
    meetingId: string;
    rawToken: string;
    expectedAction: ActionTokenAction;
  }): Promise<{ ok: true; record: ActionTokenRecord; meeting: BookingRecord } | { ok: false; error: string }> {
    if (!params.rawToken || params.rawToken.length === 0) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
    const tokenHash = hashToken(params.rawToken);
    const record = await this.tokenRepository.findByTokenHash(params.meetingId, tokenHash);
    if (!record) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
    if (record.action !== params.expectedAction) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
    if (!isActionAllowedForActor(record.actor, record.action)) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
    if (isTokenExpired(record.expiresAt, this.now())) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }

    const meeting = await this.bookingRepository.findById(params.meetingId);
    if (!meeting) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }

    // Tokens become invalid when the authoritative proposal version advances.
    if (record.usedAt === null && record.proposalVersion !== meeting.proposalVersion) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }

    // A token must still match the meeting's current status.
    if (record.usedAt === null && !isActionAllowedForStatus(params.expectedAction, meeting.status)) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }

    return { ok: true, record, meeting };
  }

  private async executeAction(params: {
    action: ActionTokenAction;
    meeting: BookingRecord;
    actor: ActionTokenActor;
    payload?: { proposedSlot?: BookingProposedSlotInput; reason?: string };
    tokenHash: string;
    tokenId: string;
  }): Promise<ActionResult> {
    const { action, meeting, actor, payload, tokenHash, tokenId } = params;
    const auditActor = mapActorToAuditActor(actor);

    switch (action) {
      case ACTION_TOKEN_ACTIONS.CONFIRM:
        return this.executeConfirm({ meeting, auditActor, tokenHash, tokenId });
      case ACTION_TOKEN_ACTIONS.PROPOSE:
        return this.executePropose({ meeting, actor, auditActor, payload, tokenHash, tokenId });
      case ACTION_TOKEN_ACTIONS.DECLINE:
        return this.executeDecline({ meeting, auditActor, payload, tokenHash, tokenId });
      case ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL:
        return this.executeAcceptProposal({ meeting, auditActor, tokenHash, tokenId });
      default:
        return { status: "rejected", error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }
  }

  /** Replay only unfinished email delivery; state transitions remain idempotent. */
  private async retryEmailDeliveryForAction(
    booking: BookingRecord,
    token: ActionTokenRecord,
  ): Promise<BookingRecord> {
    switch (token.action) {
      case ACTION_TOKEN_ACTIONS.PROPOSE: {
        if (!booking.proposedSlot) return booking;
        const followUp = getProposalFollowUp(token.actor);
        const followUpTokens = await this.issueTokens({
          meetingId: booking.id,
          actor: followUp.actor,
          actions: followUp.actions,
          proposalVersion: booking.proposalVersion,
          proposedSlotStartISO: booking.proposedSlot.startsAt,
        });
        return token.actor === ACTION_TOKEN_ACTORS.OWNER
          ? await sendRescheduleProposal(this.emailProvider, this.bookingRepository, booking, followUpTokens)
          : await sendOwnerRescheduleProposal(this.emailProvider, this.bookingRepository, booking, followUpTokens);
      }
      case ACTION_TOKEN_ACTIONS.CONFIRM:
      case ACTION_TOKEN_ACTIONS.ACCEPT_PROPOSAL: {
        if (booking.status !== "owner_confirmed" || booking.calendarDelivery.status !== "completed") {
          return booking;
        }
        const visitorTokens = await this.issueTokens({
          meetingId: booking.id,
          actor: ACTION_TOKEN_ACTORS.VISITOR,
          actions: [ACTION_TOKEN_ACTIONS.DECLINE, ACTION_TOKEN_ACTIONS.PROPOSE],
          proposalVersion: booking.proposalVersion,
          proposedSlotStartISO: null,
        });
        return sendConfirmationNotifications(this.emailProvider, this.bookingRepository, booking, visitorTokens);
      }
      case ACTION_TOKEN_ACTIONS.DECLINE: {
        const reason = this.getPersistedDeclineReason(booking);
        return token.actor === ACTION_TOKEN_ACTORS.VISITOR
          ? await sendOwnerDeclinedNotice(this.emailProvider, this.bookingRepository, booking, reason)
          : await sendDeclinedNotice(this.emailProvider, this.bookingRepository, booking, booking.identity.email, reason);
      }
      default:
        return booking;
    }
  }

  /** Confirms the slot atomically, then records recoverable Calendar failures. */
  private async executeConfirm(params: {
    meeting: BookingRecord;
    auditActor: BookingAuditActor;
    tokenHash: string;
    tokenId: string;
  }): Promise<ActionResult> {
    const { meeting, auditActor, tokenHash, tokenId } = params;

    if (meeting.status === "reschedule_proposed") {
      return this.executeAcceptProposal({ meeting, auditActor, tokenHash, tokenId });
    }

    const slotIdentity = this.getSlotIdentity(meeting);
    if (!slotIdentity) {
      return { status: "rejected", error: MEETING_ERROR_CODES.MEETING_ERROR, consumedTokenId: tokenId };
    }

    const businessRuleOk = await this.isSlotAvailable({
      date: meeting.meeting.date,
      time: meeting.meeting.time,
      timezone: meeting.visitorTimezone,
    }, meeting.id);
    if (!businessRuleOk) {
      return { status: "slot_unavailable", error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, consumedTokenId: tokenId };
    }
    const recheck = await this.authoritativeRecheck(meeting, slotIdentity);
    if (!recheck.available) {
      return recheck.reason === "freebusy_unavailable"
        ? { status: "rejected", error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE, consumedTokenId: tokenId }
        : { status: "slot_unavailable", error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, consumedTokenId: tokenId };
    }

    const reservation = await this.bookingRepository.reserveSlotForMeeting({
      meetingId: meeting.id,
      slotIdentity,
      toStatus: "owner_confirmed",
      transitionOptions: {
        actor: auditActor,
        now: this.now().toISOString(),
        payload: { action: "confirm", tokenHash },
      },
    });
    if (!reservation.success) {
      return reservation.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE
        ? { status: "slot_unavailable", error: reservation.error, consumedTokenId: tokenId }
        : { status: "rejected", error: reservation.error, consumedTokenId: tokenId };
    }
    const reservedRecord = (reservation as { record: BookingRecord }).record;

    const withCalendarEvent = await this.createCalendarEventForBooking(
      reservedRecord,
      "create",
    );

    if (withCalendarEvent.calendarDelivery.status !== "completed") {
      return {
        status: "pending",
        meeting: withCalendarEvent,
        error: MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE,
        consumedTokenId: tokenId,
      };
    }

    const visitorTokens = await this.issueTokens({
      meetingId: meeting.id,
      actor: ACTION_TOKEN_ACTORS.VISITOR,
      actions: [ACTION_TOKEN_ACTIONS.DECLINE, ACTION_TOKEN_ACTIONS.PROPOSE],
      proposalVersion: withCalendarEvent.proposalVersion,
      proposedSlotStartISO: null,
    });

    const withConfirmationEmail = await sendConfirmationNotifications(
      this.emailProvider,
      this.bookingRepository,
      withCalendarEvent,
      visitorTokens,
    );

    return {
      status: "ok",
      meeting: withConfirmationEmail,
      issuedTokens: visitorTokens,
      consumedTokenId: tokenId,
    };
  }

  private async executePropose(params: {
    meeting: BookingRecord;
    actor: ActionTokenActor;
    auditActor: BookingAuditActor;
    payload?: { proposedSlot?: BookingProposedSlotInput; reason?: string };
    tokenHash: string;
    tokenId: string;
  }): Promise<ActionResult> {
    const { meeting, actor, auditActor, payload, tokenHash, tokenId } = params;
    if (!payload?.proposedSlot) {
      return { status: "rejected", error: MEETING_ERROR_CODES.INVALID_PAYLOAD, consumedTokenId: tokenId };
    }

    const proposeResult = await this.bookingRepository.proposeAlternative(meeting.id, {
      actor: auditActor,
      payload: { action: "propose", tokenHash },
      proposedSlot: payload.proposedSlot,
    });
    if (!proposeResult.success) {
      return { status: "invalid_transition", error: proposeResult.error, consumedTokenId: tokenId };
    }
    const updated = (proposeResult as { record: BookingRecord }).record;

    if (!updated.proposedSlot) {
      return { status: "rejected", error: MEETING_ERROR_CODES.MEETING_ERROR, consumedTokenId: tokenId };
    }

    const followUp = getProposalFollowUp(actor);
    const followUpTokens = await this.issueTokens({
      meetingId: meeting.id,
      actor: followUp.actor,
      actions: followUp.actions,
      proposalVersion: updated.proposalVersion,
      proposedSlotStartISO: updated.proposedSlot.startsAt,
    });

    const withProposalEmail = actor === ACTION_TOKEN_ACTORS.OWNER
      ? await sendRescheduleProposal(this.emailProvider, this.bookingRepository, updated, followUpTokens)
      : await sendOwnerRescheduleProposal(this.emailProvider, this.bookingRepository, updated, followUpTokens);

    return {
      status: "ok",
      meeting: withProposalEmail,
      issuedTokens: followUpTokens,
      consumedTokenId: tokenId,
    };
  }

  private async executeDecline(params: {
    meeting: BookingRecord;
    auditActor: BookingAuditActor;
    payload?: { reason?: string };
    tokenHash: string;
    tokenId: string;
  }): Promise<ActionResult> {
    const { meeting, auditActor, payload, tokenHash, tokenId } = params;
    const transition = await this.bookingRepository.updateStatus(meeting.id, "declined", {
      actor: auditActor,
      payload: {
        action: "decline",
        ...(payload?.reason !== undefined ? { reason: payload.reason } : {}),
        tokenHash,
      },
    });
    if (!transition.success) {
      return { status: "invalid_transition", error: transition.error, consumedTokenId: tokenId };
    }
    const updated = (transition as { record: BookingRecord }).record;

    // Cancel an existing event so the visitor's invitation reflects the decline.
    const withCancelledCalendarEvent = meeting.calendarEventId
      ? await this.cancelCalendarEventForBooking(updated)
      : updated;
    const withDeclinedEmail = auditActor === BOOKING_AUDIT_ACTORS.VISITOR
      ? await sendOwnerDeclinedNotice(this.emailProvider, this.bookingRepository, withCancelledCalendarEvent, payload?.reason)
      : await sendDeclinedNotice(
        this.emailProvider,
        this.bookingRepository,
        withCancelledCalendarEvent,
        withCancelledCalendarEvent.identity.email,
        payload?.reason,
      );

    return {
      status: "ok",
      meeting: withDeclinedEmail,
      issuedTokens: [],
      consumedTokenId: tokenId,
    };
  }

  private async executeAcceptProposal(params: {
    meeting: BookingRecord;
    auditActor: BookingAuditActor;
    tokenHash: string;
    tokenId: string;
  }): Promise<ActionResult> {
    const { meeting, auditActor, tokenHash, tokenId } = params;
    const proposedSlot = meeting.proposedSlot;
    if (!proposedSlot) {
      return { status: "rejected", error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE, consumedTokenId: tokenId };
    }

    const slotIdentity = this.getProposedSlotIdentity(meeting);
    if (!slotIdentity) {
      return { status: "rejected", error: MEETING_ERROR_CODES.MEETING_ERROR, consumedTokenId: tokenId };
    }

    const businessRuleOk = await this.isSlotAvailable({
      date: proposedSlot.date,
      time: proposedSlot.time,
      timezone: proposedSlot.visitorTimezone,
    }, meeting.id);
    if (!businessRuleOk) {
      return { status: "slot_unavailable", error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, consumedTokenId: tokenId };
    }
    const recheck = await this.authoritativeRecheck(meeting, slotIdentity);
    if (!recheck.available) {
      return recheck.reason === "freebusy_unavailable"
        ? { status: "rejected", error: MEETING_ERROR_CODES.BOOKING_TEMPORARILY_UNAVAILABLE, consumedTokenId: tokenId }
        : { status: "slot_unavailable", error: MEETING_ERROR_CODES.SLOT_UNAVAILABLE, consumedTokenId: tokenId };
    }

    const reservation = await this.bookingRepository.reserveSlotForMeeting({
      meetingId: meeting.id,
      slotIdentity,
      toStatus: "owner_confirmed",
      transitionOptions: {
        actor: auditActor,
        now: this.now().toISOString(),
        payload: { action: "accept_proposal", tokenHash, proposedSlot },
      },
    });
    if (!reservation.success) {
      return reservation.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE
        ? { status: "slot_unavailable", error: reservation.error, consumedTokenId: tokenId }
        : { status: "rejected", error: reservation.error, consumedTokenId: tokenId };
    }
    const reservedRecord = (reservation as { record: BookingRecord }).record;

    const action: CalendarEventAuditAction = reservedRecord.calendarEventId ? "update" : "create";
    const withCalendarEvent = await this.createCalendarEventForBooking(
      reservedRecord,
      action,
    );

    if (withCalendarEvent.calendarDelivery.status !== "completed") {
      return {
        status: "pending",
        meeting: withCalendarEvent,
        error: MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE,
        consumedTokenId: tokenId,
      };
    }

    const visitorTokens = await this.issueTokens({
      meetingId: meeting.id,
      actor: ACTION_TOKEN_ACTORS.VISITOR,
      actions: [ACTION_TOKEN_ACTIONS.DECLINE, ACTION_TOKEN_ACTIONS.PROPOSE],
      proposalVersion: withCalendarEvent.proposalVersion,
      proposedSlotStartISO: null,
    });

    const withConfirmationEmail = await sendConfirmationNotifications(
      this.emailProvider,
      this.bookingRepository,
      withCalendarEvent,
      visitorTokens,
    );

    return {
      status: "ok",
      meeting: withConfirmationEmail,
      issuedTokens: visitorTokens,
      consumedTokenId: tokenId,
    };
  }

  private async isSlotAvailable(
    slot: { date: string; time: string; timezone: BookingRecord["visitorTimezone"] },
    bookingId: string,
  ): Promise<boolean> {
    try {
      const slots = await this.availabilityRepository.getSlots({
        date: slot.date,
        timezone: slot.timezone,
      });
      return slots.some((availableSlot) => availableSlot.time === slot.time);
    } catch (error) {
      meetLogger.error("action.availability_check_failed", {
        bookingId,
        cause: normalizeErrorCause(error),
      });
      return false;
    }
  }

  private getPersistedDeclineReason(booking: BookingRecord): string | undefined {
    const declineEvent = [...booking.auditLog]
      .reverse()
      .find((event) => event.action === "status_changed" && event.toStatus === "declined");
    const reason = declineEvent?.payload.reason;
    return typeof reason === "string" && reason.trim() ? reason : undefined;
  }

  private async authoritativeRecheck(
    meeting: BookingRecord,
    slotIdentity: SlotIdentity,
  ): Promise<AuthoritativeRecheckResult> {
    try {
      return await authoritativeFreeBusyRecheck({
        startISO: slotIdentity,
        meetingId: meeting.id,
      });
    } catch (error) {
      meetLogger.error("action.authoritative_recheck_failed", {
        bookingId: meeting.id,
        cause: normalizeErrorCause(error),
      });
      return { available: false, reason: "freebusy_unavailable" };
    }
  }

  private async createCalendarEventForBooking(
    meeting: BookingRecord,
    action: CalendarEventAuditAction,
  ): Promise<BookingRecord> {
    let result: CalendarProviderSuccess | CalendarProviderFailure;
    try {
      if (action === "update" && meeting.calendarEventId) {
        result = await this.calendarProvider.updateEvent(meeting);
      } else {
        result = await this.calendarProvider.createEvent(meeting);
      }
    } catch (error) {
      meetLogger.error("calendar.provider_unexpected_error", {
        bookingId: meeting.id,
        cause: normalizeErrorCause(error),
        provider: "calendar",
      });
      result = {
        success: false,
        error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR,
      };
    }

    let updatedRecord: BookingRecord;
    if (result.success) {
      updatedRecord =
        (await this.bookingRepository.updateProviderDetails(meeting.id, result.event)) ??
        meeting;
    } else {
      updatedRecord =
        (await this.bookingRepository.updateProviderDelivery(meeting.id, "calendar", {
          errorCode: result.error,
          status: "failed",
        })) ??
        meeting;
      meetLogger.warn("booking.provider_failed", {
        bookingId: meeting.id,
        deliveryState: "failed",
        errorCode: result.error,
        provider: "calendar",
      });
    }

    await recordCalendarEventAudit({
      id: crypto.randomUUID(),
      meetingId: meeting.id,
      action,
      provider: this.calendarProvider instanceof GoogleCalendarMockProvider ? "mock" : "google",
      calendarEventId:
        (result.success ? result.event.calendarEventId : updatedRecord.calendarEventId) ??
        "",
      googleMeetUrl:
        (result.success ? result.event.googleMeetUrl : updatedRecord.googleMeetUrl) ?? "",
      status: result.success ? "completed" : "failed",
      ...(result.success ? {} : { errorCode: result.error }),
      attemptNumber: updatedRecord.calendarDelivery.attempts,
    });

    return updatedRecord;
  }

  private async cancelCalendarEventForBooking(meeting: BookingRecord): Promise<BookingRecord> {
    if (!meeting.calendarEventId) return meeting;
    let result: CalendarProviderSuccess | CalendarProviderFailure;
    try {
      result = await this.calendarProvider.deleteEvent(meeting.calendarEventId);
    } catch (error) {
      meetLogger.error("calendar.provider_unexpected_error", {
        bookingId: meeting.id,
        cause: normalizeErrorCause(error),
        provider: "calendar",
      });
      result = {
        success: false,
        error: CALENDAR_PROVIDER_ERROR_CODES.CALENDAR_PROVIDER_ERROR,
      };
    }

    let updatedRecord: BookingRecord;
    if (result.success) {
      // Preserve canonical event fields while treating cancellation as complete.
      updatedRecord =
        (await this.bookingRepository.updateProviderDelivery(meeting.id, "calendar", {
          status: "completed",
        })) ??
        meeting;
    } else {
      updatedRecord =
        (await this.bookingRepository.updateProviderDelivery(meeting.id, "calendar", {
          errorCode: result.error,
          status: "failed",
        })) ??
        meeting;
      meetLogger.warn("booking.provider_failed", {
        bookingId: meeting.id,
        deliveryState: "failed",
        errorCode: result.error,
        provider: "calendar",
      });
    }

    await recordCalendarEventAudit({
      id: crypto.randomUUID(),
      meetingId: meeting.id,
      action: "cancel",
      provider: this.calendarProvider instanceof GoogleCalendarMockProvider ? "mock" : "google",
      calendarEventId: meeting.calendarEventId,
      googleMeetUrl: meeting.googleMeetUrl ?? "",
      status: result.success ? "completed" : "failed",
      ...(result.success ? {} : { errorCode: result.error }),
      attemptNumber: updatedRecord.calendarDelivery.attempts,
    });

    return updatedRecord;
  }

  private getSlotIdentity(meeting: BookingRecord): SlotIdentity | null {
    try {
      return getSlotIdentity({
        date: meeting.meeting.date,
        time: meeting.meeting.time,
        timezone: meeting.visitorTimezone,
      });
    } catch {
      return null;
    }
  }

  private getProposedSlotIdentity(meeting: BookingRecord): SlotIdentity | null {
    if (!meeting.proposedSlot) return null;
    try {
      return getSlotIdentity({
        date: meeting.proposedSlot.date,
        time: meeting.proposedSlot.time,
        timezone: meeting.proposedSlot.visitorTimezone,
      });
    } catch {
      return null;
    }
  }
}

/** Issues the initial owner action set for a newly requested booking. */
export async function issueOwnerTokensForNewBooking(
  service: ActionService,
  booking: BookingRecord,
): Promise<IssuedActionToken[]> {
  return service.issueTokens({
    meetingId: booking.id,
    actor: ACTION_TOKEN_ACTORS.OWNER,
    actions: [
      ACTION_TOKEN_ACTIONS.CONFIRM,
      ACTION_TOKEN_ACTIONS.PROPOSE,
      ACTION_TOKEN_ACTIONS.DECLINE,
    ],
    proposalVersion: booking.proposalVersion,
    proposedSlotStartISO: null,
  });
}
