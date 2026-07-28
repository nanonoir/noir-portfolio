export const MEETING_ORIGINS = {
  CONTACT: "contact",
  SERVICE: "service",
  CUSTOM_SOFTWARE: "custom_software",
} as const;

export type MeetingOrigin = (typeof MEETING_ORIGINS)[keyof typeof MEETING_ORIGINS];

export const CONTACT_REASONS = {
  PROJECT: "project",
  JOB: "job",
  GENERAL: "general",
} as const;

export type ContactReason = (typeof CONTACT_REASONS)[keyof typeof CONTACT_REASONS];

export const MEETING_STATUSES = {
  REQUESTED: "requested",
  RESCHEDULE_PROPOSED: "reschedule_proposed",
  OWNER_CONFIRMED: "owner_confirmed",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[keyof typeof MEETING_STATUSES];

declare const localeBrand: unique symbol;
declare const timezoneBrand: unique symbol;
declare const slotIdentityBrand: unique symbol;

export type Locale = string & { readonly [localeBrand]: "Locale" };
export type Timezone = string & { readonly [timezoneBrand]: "Timezone" };
export type SlotIdentity = string & { readonly [slotIdentityBrand]: "SlotIdentity" };

export interface Slot {
  time: string;
  available: true;
  /**
   * Canonical UTC start of the slot (PRD §4.3, §5.1). Identical across
   * timezones for the same instant. Mock provider may omit it for legacy
   * compatibility; Google and Unverified providers always emit it.
   */
  startISO?: string;
  /**
   * Canonical UTC end of the slot (start + 30 minutes, PRD §4.1). Same note
   * as `startISO` for mock compatibility.
   */
  endISO?: string;
  /**
   * `verified` means the Google Calendar FreeBusy check ran successfully and
   * the slot is free on the primary calendar. `unverified` means real
   * availability could not be checked (e.g., `GOOGLE_REFRESH_TOKEN` absent):
   * the slot satisfies business rules but no Calendar conflict check ran.
   * Mock provider omits this for legacy compatibility.
   */
  availabilityStatus?: "verified" | "unverified";
}
