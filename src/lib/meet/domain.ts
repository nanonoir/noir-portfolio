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
  CONFIRMED: "confirmed",
  RESCHEDULE_PROPOSED: "reschedule_proposed",
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
}
