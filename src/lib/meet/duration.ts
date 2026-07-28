/** Shared meeting duration rules for browser and server consumers. */
export const MEETING_DURATION_MINUTES = 30;
export const MEETING_BUFFER_MINUTES = 30;
export const SLOT_INTERVAL_MINUTES = MEETING_DURATION_MINUTES + MEETING_BUFFER_MINUTES;
export const MEETING_DURATION_MS = MEETING_DURATION_MINUTES * 60 * 1000;

export function addMeetingDuration(start: Date): Date {
  return new Date(start.getTime() + MEETING_DURATION_MS);
}
