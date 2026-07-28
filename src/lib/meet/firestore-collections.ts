import "server-only";

/**
 * Firestore collection path constants for the Meet backend (PRD §6.1).
 *
 * Phase 2 persists `meetings` and `reservedSlots`. `events` and `actionTokens`
 * are subcollections of `meetings` reserved for later phases (Calendar event
 * audit trail and opaque action tokens); the path helpers exist now so future
 * phases inject them without touching collection wiring.
 *
 * All helpers are server-only: nothing here is reachable from a client bundle.
 */

export const MEET_COLLECTIONS = {
  MEETINGS: "meetings",
  RESERVED_SLOTS: "reservedSlots",
  EVENTS: "events",
  ACTION_TOKENS: "actionTokens",
} as const;

export function meetingsCollection() {
  return MEET_COLLECTIONS.MEETINGS;
}

export function meetingDoc(id: string) {
  return `${MEET_COLLECTIONS.MEETINGS}/{id}`.replace("{id}", id);
}

export function reservedSlotsCollection() {
  return MEET_COLLECTIONS.RESERVED_SLOTS;
}

export function reservedSlotDoc(slotIdentity: string) {
  return `${MEET_COLLECTIONS.RESERVED_SLOTS}/${slotIdentity}`;
}

export function eventsSubcollection(meetingId: string) {
  return `${MEET_COLLECTIONS.MEETINGS}/${meetingId}/${MEET_COLLECTIONS.EVENTS}`;
}

export function actionTokensSubcollection(meetingId: string) {
  return `${MEET_COLLECTIONS.MEETINGS}/${meetingId}/${MEET_COLLECTIONS.ACTION_TOKENS}`;
}

/**
 * Normalize an email for the `emailNormalized` index (PRD §6.2). Lowercased and
 * trimmed; no validation, no encoding — store-only for queries.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
