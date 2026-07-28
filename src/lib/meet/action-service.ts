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
  sendDeclinedNotice,
  sendMeetingConfirmation,
  sendOwnerDeclinedNotice,
  sendOwnerRescheduleProposal,
  sendRescheduleProposal,
} from "./email-notifications";

/**
 * Phase 4 action security service (PRD §7, §13.4).
 *
 * Responsibilities:
 *  - issue token sets for the next actor at each state transition;
 *  - validate raw tokens (hash → record → actor/action/expiry/proposalVersion
 *    checks) without ever persisting the raw token;
 *  - consume a token idempotently: validate → execute action → record result
 *    → mark used → return the same result on every subsequent compatible
 *    presentation;
 *  - reject stale/expired/wrong-actor/wrong-action tokens with the stable
 *    `LINK_NOT_ACTIVE` code;
 *  - enforce the approved state machine through the existing
 *    `BookingRepository`/lifecycle ports.
 *
 * Server-only: every method is server-side; route handlers are the only
 * callers. The service never logs raw tokens, audit payloads include only the
 * token hash.
 */

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
  /** Tokens issued for the next actor (or empty). Passed to Phase 6 email. */
  issuedTokens?: IssuedActionToken[];
  /** Hash-only audit context for observability; never contains the raw token. */
  consumedTokenId?: string;
}

/**
 * Per PRD §7, a token must validate against the meeting's CURRENT status.
 * Each action is only valid from a specific set of statuses. A token issued
 * for an earlier status (e.g. a visitor `decline` token minted while the
 * meeting was `owner_confirmed`) is no longer "compatible" once the meeting
 * has moved to a status that no longer admits that action, and the action link
 * MUST return `LINK_NOT_ACTIVE` rather than silently perform a stale action.
 */
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

  /**
   * Mint a token set for one actor. Idempotent at the caller's responsibility
   * (caller tracks whether tokens for the current state were already issued).
   * Returns raw tokens once; only the hash is persisted.
   */
  async issueTokens(input: IssueTokensInput): Promise<IssuedActionToken[]> {
    const issuedAt = this.now();
    const issued: IssuedActionToken[] = [];

    for (const action of input.actions) {
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      // For accept_proposal, anchor expiry on the proposed slot start. For
      // decline/confirm/propose, use the action's default
      // TTL. We don't synthesize a fake BookingProposedSlot; pass null when
      // the caller hasn't supplied a proposed slot start.
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

  /**
   * Validate a raw token against `meetingId` and `expectedAction` without
   * consuming it. Used by GET confirmation pages (PRD §7: no side effects on
   * GET). Returns the decoded token record or `null` with a stable error code.
   */
  async previewAction(params: {
    meetingId: string;
    rawToken: string;
    expectedAction: ActionTokenAction;
  }): Promise<{ ok: true; record: ActionTokenRecord; meeting: BookingRecord } | { ok: false; error: string }> {
    return this.validate(params);
  }

  /**
   * Consume a token and execute the corresponding action. Idempotent: a
   * repeated compatible presentation returns the cached result without
   * re-executing the action.
   */
  async consumeAction(params: {
    meetingId: string;
    rawToken: string;
    expectedAction: ActionTokenAction;
    /**
     * Optional payload for `propose` (new proposed slot) and `decline`
     * (optional reason). `confirm` and `accept_proposal` do not require a
     * payload.
     */
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

    // A completed action replays safely. A processing marker alone is not proof
    // of a business transition; it is reconciled through a lease claim below.
    if (token.usedAt !== null && token.result !== null && !isActionProcessingResult(token.result)) {
      const replayedMeeting = (await this.bookingRepository.findById(meeting.id)) ?? meeting;
      // Phase 5 recoverable provider delivery: the state transition and slot
      // reservation are already durable, but Calendar may have failed after
      // `owner_confirmed`. A compatible replay MUST NOT re-run the action;
      // it may retry ONLY the unfinished Calendar provider (PRD §13.5
      // "Calendar failures do not lose the booking").
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

    // Only the successful compare-and-set claimant may execute the action.
    // If an unexpected post-claim exception occurs, reconcile only this
    // execution's claim. A durable business transition must remain consumed so
    // a replay cannot duplicate provider effects; an uncommitted action can be
    // safely retried.
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
      // Rejected domain transitions leave the token usable, matching the
      // prior behavior where only definitive actions consumed a token.
      await this.tokenRepository.releaseUse(meeting.id, token.id, processingClaim);
    }

    return executed;
  }

  /**
   * Phase 5 server-side cancellation path (PRD §8.3, §13.5).
   *
   * No public cancellation route is introduced in this phase (that would be
   * new UI/action-token scope). This server-only method is the shared path for
   * a future owner cancellation surface or Phase 7 RSVP/admin workflow:
   * transition the meeting to `cancelled`, release its reservation through the
   * repository, then cancel (not delete) the persisted Calendar event.
   */
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

    // Proposal version check: a token issued for proposal version N is no
    // longer usable once the meeting advances to version N+1. The booking's
    // `proposalVersion` is the current authoritative version.
    if (record.usedAt === null && record.proposalVersion !== meeting.proposalVersion) {
      return { ok: false, error: MEETING_ERROR_CODES.LINK_NOT_ACTIVE };
    }

    // Status check: a token issued for an earlier status is no longer
    // compatible once the meeting has moved on. PRD §7 requires status
    // validation alongside token, actor, action, proposalVersion, expiry.
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

  /**
   * Phase 6 compatible replay recovery. Token consumption remains idempotent:
   * never repeat a state transition/reservation; only re-issue links and retry
   * the unfinished email provider. Each Resend message carries a stable
   * template/booking/proposal/recipient idempotency key, so if the original
   * provider accepted an email before local persistence failed Resend returns
   * the original delivery rather than sending a duplicate.
   */
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
        return sendMeetingConfirmation(this.emailProvider, this.bookingRepository, booking, visitorTokens);
      }
      case ACTION_TOKEN_ACTIONS.DECLINE:
        return token.actor === ACTION_TOKEN_ACTORS.VISITOR
          ? await sendOwnerDeclinedNotice(this.emailProvider, this.bookingRepository, booking)
          : await sendDeclinedNotice(this.emailProvider, this.bookingRepository, booking, booking.identity.email);
      default:
        return booking;
    }
  }

  /**
   * `confirm` (owner): Phase 5 atomic flow (PRD §8.3).
   *
   *  1. re-check availability (FreeBusy authoritative recheck);
   *  2. transactionally reserve the UTC slot + transition
   *     `requested → owner_confirmed`;
   *  3. create one Calendar event with Nahuel as organizer and the visitor as
   *     attendee;
   *  4. generate Google Meet;
   *  5. persist `calendarEventId` and `googleMeetUrl`;
   *  6. set `owner_confirmed` (done in step 2);
   *  7. send the Calendar invitation (Google sends automatically because
   *     `sendUpdates: "all"`);
   *
   * Calendar failure does NOT roll back the reservation (PRD §13.5
   * "Calendar failures do not lose the booking"). The booking stays
   * `owner_confirmed`, `calendarDelivery` flips to `failed`, and the audit
   * trail records the failure; the next replay will retry only the provider.
   */
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

    // PRD §8.3 step 1: authoritative FreeBusy recheck before reservation.
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

    // PRD §8.3 steps 2 + 6: atomic reservation + transition in one transaction.
    const reservation = await this.bookingRepository.reserveSlotForMeeting({
      meetingId: meeting.id,
      slotIdentity,
      toStatus: "owner_confirmed",
      transitionOptions: {
        actor: auditActor,
        payload: { action: "confirm", tokenHash },
      },
    });
    if (!reservation.success) {
      return reservation.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE
        ? { status: "slot_unavailable", error: reservation.error, consumedTokenId: tokenId }
        : { status: "rejected", error: reservation.error, consumedTokenId: tokenId };
    }
    const reservedRecord = (reservation as { record: BookingRecord }).record;

    // PRD §8.3 steps 3–5 + Calendar invitation: create the Calendar event AND
    // persist IDs / delivery state. Failures are audited separately; the booking
    // stays `owner_confirmed`.
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

    const withConfirmationEmail = await sendMeetingConfirmation(
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

  /** `propose` (owner or visitor): transition to `reschedule_proposed` with a
   * new slot, then issue the counterparty's actor-specific token set. */
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

  /** `decline` (owner or visitor): Phase 5 declines (PRD §8.3, §13.5).
   *
   * Slot release is handled by `BookingRepository.updateStatus` (Firestore)
   * or the mock repo's terminal-status cleanup. If a Calendar event already
   * existed (previous `owner_confirmed`), the event is CANCELLED (not deleted)
   * so Nahuel's Calendar keeps the cancelled trace.
   */
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

    // If a Calendar event was already created (previous `owner_confirmed`)
    // cancel it so the visitor's Calendar invitation reflects the decline.
    const withCancelledCalendarEvent = meeting.calendarEventId
      ? await this.cancelCalendarEventForBooking(updated)
      : updated;
    const withDeclinedEmail = auditActor === BOOKING_AUDIT_ACTORS.VISITOR
      ? await sendOwnerDeclinedNotice(this.emailProvider, this.bookingRepository, withCancelledCalendarEvent)
      : await sendDeclinedNotice(
        this.emailProvider,
        this.bookingRepository,
        withCancelledCalendarEvent,
        withCancelledCalendarEvent.identity.email,
      );

    return {
      status: "ok",
      meeting: withDeclinedEmail,
      issuedTokens: [],
      consumedTokenId: tokenId,
    };
  }

  /** `accept_proposal` (visitor): Phase 5 atomic flow (PRD §8.3).
   *
   *  1. re-check availability for the PROPOSED slot (FreeBusy authoritative);
   *  2. transactionally reserve the proposed UTC slot + release the prior
   *     slot + transition `reschedule_proposed → owner_confirmed`;
   *  3. update the existing Calendar event (preserve deterministic event id
   *     and Meet link) OR create a new event if none exists yet;
   *  4. persist `calendarEventId` / `googleMeetUrl`;
   *  5. set `owner_confirmed` (done in step 2);
   *  6. send the Calendar invitation (`sendUpdates: "all"`).
   */
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

    // PRD §8.3 step 1: authoritative FreeBusy recheck on the PROPOSED slot.
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

    // PRD §8.3 steps 2 + 6: atomic reservation of the proposed slot, release
    // of any prior reservation owned by this meeting, and transition
    // `reschedule_proposed → owner_confirmed` in one transaction.
    const reservation = await this.bookingRepository.reserveSlotForMeeting({
      meetingId: meeting.id,
      slotIdentity,
      toStatus: "owner_confirmed",
      transitionOptions: {
        actor: auditActor,
        payload: { action: "accept_proposal", tokenHash, proposedSlot },
      },
    });
    if (!reservation.success) {
      return reservation.error === MEETING_ERROR_CODES.SLOT_UNAVAILABLE
        ? { status: "slot_unavailable", error: reservation.error, consumedTokenId: tokenId }
        : { status: "rejected", error: reservation.error, consumedTokenId: tokenId };
    }
    const reservedRecord = (reservation as { record: BookingRecord }).record;

    // PRD §8.3 steps 3–5 + Calendar invitation: PATCH the existing event if
    // `calendarEventId` is non-null (preserve Meet link), otherwise create
    // the event. Idempotency on deterministic event id.
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

    const withConfirmationEmail = await sendMeetingConfirmation(
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

  /**
   * PRD §8.3 step 1: authoritative FreeBusy recheck. Delegates to
   * `authoritativeFreeBusyRecheck` (server-only helper) for the FreeBusy
   * primary-calendar check; when Google env is absent, the helper falls back
   * to a Firestore `reservedSlots` conflict check only (PRD §4.3 unverified
   * safe-degraded). Returns true when the slot is available.
   */
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

  /**
   * PRD §8.3 steps 3–5 + Calendar invitation: create OR update the Calendar
   * event for `meeting` (depending on `action`), persist the canonical
   * `calendarEventId` / `googleMeetUrl` and delivery state, and append the
   * event audit row. Calendar failure is non-fatal — the booking stays
   * `owner_confirmed` (or whatever status the reservation transaction left
   * it at); the returned `BookingRecord` carries the failed delivery state so
   * the next replay can retry only the provider. The audit record captures the
   * action and outcome for operational recovery.
   */
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

    // PRD §13.5 "persist under meetings/events": one audit row per attempt,
    // with the canonical calendarEventId/googleMeetUrl and delivery outcome.
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

  /**
   * PRD §8.3 + §13.5 "Cancel events rather than deleting them". Cancels the
   * Calendar event (PATCH `status: "cancelled"`) for `meeting`, persists the
   * delivery state, and writes the event audit row. Failure does NOT change
   * the meeting status (already `declined`); it leaves the event in Calendar
   * and records the failure for retry.
   */
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
      // Treat cancel completion as `calendarDelivery: completed` so we don't
      // accumulate a redundant failure audit. The canonical
      // `calendarEventId`/`googleMeetUrl` fields stay populated to preserve
      // the audit trail of the original event id.
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

/**
 * Tokens issued for Nahuel immediately after a new `requested` booking is
 * created (PRD §7: administrative token for Nahuel). The booking service calls
 * this once per successful create so Phase 6 email can embed confirm/propose/
 * decline links.
 */
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
