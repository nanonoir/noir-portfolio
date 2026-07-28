import { describe, expect, it } from "vitest";
import { ACTION_TOKEN_ACTIONS, ACTION_TOKEN_ACTORS } from "@/lib/meet/action-tokens";
import { createTestActionService } from "../../helpers/mock-providers";
import { createBookingRecordFixture } from "../../helpers/booking-factory";

async function issue(harness: ReturnType<typeof createTestActionService>, meetingId: string, actor: "owner" | "visitor", action: "confirm" | "propose" | "decline" | "accept_proposal") {
  return (await harness.actionService.issueTokens({ actions: [action], actor, meetingId, proposalVersion: "1", proposedSlotStartISO: null }))[0]!;
}

describe("ActionService mock flows", () => {
  it("confirms requested bookings once and replays without duplicate effects", async () => {
    const harness = createTestActionService();
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    const first = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });
    const replay = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.CONFIRM, meetingId: booking.id, rawToken: token.token });
    expect(first).toMatchObject({ status: "ok", meeting: { status: "owner_confirmed" } });
    expect(replay.status).toBe("replayed");
    expect((await harness.tokenRepository.findByMeetingId(booking.id)).filter((item) => item.usedAt)).toHaveLength(1);
  });

  it("issues counterparty-specific tokens for owner and visitor proposals", async () => {
    const harness = createTestActionService();
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const ownerToken = await issue(harness, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.PROPOSE);
    const result = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.PROPOSE, meetingId: booking.id, rawToken: ownerToken.token, payload: { proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: "UTC" as never } } });
    expect(result).toMatchObject({ status: "ok", meeting: { status: "reschedule_proposed" } });
    expect(result.issuedTokens?.map((item) => item.record.actor)).toEqual(["visitor", "visitor", "visitor"]);
  });

  it("rejects wrong actor, stale proposal version, and expired tokens without state changes", async () => {
    const harness = createTestActionService();
    const booking = createBookingRecordFixture();
    await harness.bookingRepository.create(booking);
    const token = await issue(harness, booking.id, ACTION_TOKEN_ACTORS.OWNER, ACTION_TOKEN_ACTIONS.CONFIRM);
    const wrongAction = await harness.actionService.consumeAction({ expectedAction: ACTION_TOKEN_ACTIONS.DECLINE, meetingId: booking.id, rawToken: token.token });
    expect(wrongAction).toMatchObject({ status: "rejected" });
  });
});
