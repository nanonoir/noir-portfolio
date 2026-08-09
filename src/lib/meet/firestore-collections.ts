import "server-only";

/** Server-only Firestore collection paths for the Meet backend. */

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

/** Normalizes the query index value without validation or encoding. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
