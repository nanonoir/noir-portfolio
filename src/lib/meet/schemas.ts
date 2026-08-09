import "server-only";

import { z } from "zod";
import type { BookingProposedSlotInput } from "./booking-model";
import { CONTACT_REASONS, MEETING_ORIGINS, MEETING_STATUSES } from "./domain";
import type { Timezone } from "./domain";
import { MEETING_ERROR_CODES, MEETING_RESPONSE_CODES } from "./codes";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  });

export const localeSchema = z.string().trim().regex(localePattern);

export const meetingScheduleSchema = z.object({
  date: z.string().trim().regex(datePattern),
  time: z.string().trim().regex(timePattern),
  timezone: timezoneSchema,
});

export const availabilityRequestSchema = z.object({
  date: z.string().trim().regex(datePattern),
  timezone: timezoneSchema,
});

export const proposedSlotSchema = z.object({
  date: z.string().trim().regex(datePattern),
  time: z.string().trim().regex(timePattern),
  visitorTimezone: timezoneSchema,
});

export function parseProposedSlot(input: unknown): BookingProposedSlotInput | null {
  const parsed = proposedSlotSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  return {
    date: parsed.data.date,
    time: parsed.data.time,
    visitorTimezone: parsed.data.visitorTimezone as Timezone,
  };
}

const identitySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().trim().min(1),
  message: z.string().trim().max(500).optional(),
});

const detailPrimitiveSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const detailValueSchema = z.union([
  detailPrimitiveSchema,
  z.array(detailPrimitiveSchema).max(100),
]);

export const previousRequestDetailsSchema = z
  .record(z.string().min(1).max(64), detailValueSchema)
  .refine((details) => Object.keys(details).length <= 50, "Details cannot contain more than 50 keys");

export const proposalMetadataSchema = z.object({
  proposalVersion: z.string().trim().min(1),
  originVersion: z.string().trim().min(1),
  submittedAt: z.iso.datetime(),
});

const bookingRequestBaseSchema = z.object({
  type: z.literal("meeting_request"),
  identity: identitySchema,
  locale: localeSchema,
  idempotencyKey: z.uuid(),
  proposalMetadata: proposalMetadataSchema,
  meeting: meetingScheduleSchema,
});

const contactBookingRequestSchema = bookingRequestBaseSchema.extend({
  origin: z.literal(MEETING_ORIGINS.CONTACT),
  reason: z.enum([CONTACT_REASONS.PROJECT, CONTACT_REASONS.JOB, CONTACT_REASONS.GENERAL]),
});

const serviceBookingRequestSchema = bookingRequestBaseSchema.extend({
  origin: z.literal(MEETING_ORIGINS.SERVICE),
  relatedService: z.string().trim().min(1).max(128),
  previousRequest: z.object({
    service: z.string().trim().min(1).max(128),
    details: previousRequestDetailsSchema,
  }),
});

const customSoftwareBookingRequestSchema = bookingRequestBaseSchema.extend({
  origin: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
  relatedService: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
  previousRequest: z.object({
    service: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
    details: previousRequestDetailsSchema,
  }),
});

export const bookingRequestSchema = z.discriminatedUnion("origin", [
  contactBookingRequestSchema,
  serviceBookingRequestSchema,
  customSoftwareBookingRequestSchema,
]);

export const availabilitySuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.literal(MEETING_RESPONSE_CODES.AVAILABILITY_AVAILABLE),
  date: z.string().trim().regex(datePattern),
  timezone: timezoneSchema,
  slots: z.array(
    z.object({
      time: z.string().trim().regex(timePattern),
      available: z.literal(true),
      // Optional for compatibility with legacy mock payloads.
      startISO: z.iso.datetime().optional(),
      endISO: z.iso.datetime().optional(),
      // Optional status distinguishes FreeBusy verification from safe fallback.
      availabilityStatus: z.enum(["verified", "unverified"]).optional(),
    }),
  ),
});

export const availabilityErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    MEETING_ERROR_CODES.AVAILABILITY_ERROR,
    MEETING_ERROR_CODES.AVAILABILITY_UNAVAILABLE,
    MEETING_ERROR_CODES.INVALID_TIMEZONE,
  ]),
});

export const bookingSuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.literal(MEETING_RESPONSE_CODES.REQUEST_ACCEPTED),
  meetingId: z.string().trim().min(1),
  status: z.literal(MEETING_STATUSES.REQUESTED),
  /** Sanitized aggregate only; provider causes remain server-side. */
  emailDeliveryStatus: z.enum(["pending", "completed", "failed"]),
});

export const bookingErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    MEETING_ERROR_CODES.MEETING_ERROR,
    MEETING_ERROR_CODES.SLOT_UNAVAILABLE,
    MEETING_ERROR_CODES.IDEMPOTENCY_REPLAY,
    MEETING_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    MEETING_ERROR_CODES.PROVIDER_UNAVAILABLE,
  ]),
});
