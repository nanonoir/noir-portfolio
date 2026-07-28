import { describe, expect, it } from "vitest";
import { BOOKING_AUDIT_ACTORS } from "@/lib/meet/audit-events";
import { BOOKING_LIFECYCLE_ERROR_CODES, canTransitionBooking, proposeAlternativeBooking, transitionBooking, transitionBookingWithAcceptedProposal } from "@/lib/meet/booking-lifecycle";
import { createBookingRecordFixture } from "../../helpers/booking-factory";

describe("booking lifecycle", () => {
  it("permits requested terminal and proposal transitions", () => {
    for (const status of ["owner_confirmed", "reschedule_proposed", "declined", "expired", "cancelled"] as const) {
      expect(transitionBooking(createBookingRecordFixture(), status, { now: "2026-08-03T12:00:00.000Z" }).success).toBe(true);
    }
    expect(canTransitionBooking("cancelled", "requested")).toBe(false);
    expect(transitionBooking({ ...createBookingRecordFixture(), status: "confirmed" }, "requested")).toEqual({ error: BOOKING_LIFECYCLE_ERROR_CODES.INVALID_STATUS_TRANSITION, success: false });
  });

  it("expires proposals and promotes accepted slots", () => {
    const proposed = proposeAlternativeBooking(createBookingRecordFixture(), { actor: BOOKING_AUDIT_ACTORS.TEAM, now: "2026-08-03T12:00:00.000Z", proposedSlot: { date: "2026-08-05", time: "11:00", visitorTimezone: "UTC" as never } });
    if (!proposed.success) throw new Error("fixture proposal failed");
    expect(transitionBooking(proposed.record, "owner_confirmed", { now: proposed.record.expiresAt! })).toEqual({ error: BOOKING_LIFECYCLE_ERROR_CODES.PROPOSAL_EXPIRED, success: false });
    const accepted = transitionBookingWithAcceptedProposal(proposed.record, "owner_confirmed", { now: "2026-08-03T13:00:00.000Z" });
    if (!accepted.success) throw new Error("fixture acceptance failed");
    expect(accepted.record).toMatchObject({ expiresAt: null, meeting: { date: "2026-08-05", time: "11:00" }, proposedSlot: null, proposalVersion: "2" });
    expect(accepted.record.auditLog).toHaveLength(2);
  });
});
