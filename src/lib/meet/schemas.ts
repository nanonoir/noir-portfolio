import "server-only";

import { z } from "zod";
import { CONTACT_REASONS, MEETING_ORIGINS, MEETING_STATUSES } from "./domain";
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

const identitySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().trim().min(1),
  message: z.string().trim().max(500).optional(),
});

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
  relatedService: z.string().trim().min(1),
  previousRequest: z.object({
    service: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()),
  }),
});

const customSoftwareBookingRequestSchema = bookingRequestBaseSchema.extend({
  origin: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
  relatedService: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
  previousRequest: z.object({
    service: z.literal(MEETING_ORIGINS.CUSTOM_SOFTWARE),
    details: z.record(z.string(), z.unknown()),
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
  slots: z.array(z.object({ time: z.string().trim().regex(timePattern), available: z.literal(true) })),
});

export const availabilityErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal(MEETING_ERROR_CODES.AVAILABILITY_ERROR),
});

export const bookingSuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.literal(MEETING_RESPONSE_CODES.REQUEST_ACCEPTED),
  meetingId: z.string().trim().min(1),
  status: z.literal(MEETING_STATUSES.REQUESTED),
});

export const bookingErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    MEETING_ERROR_CODES.MEETING_ERROR,
    MEETING_ERROR_CODES.SLOT_UNAVAILABLE,
    MEETING_ERROR_CODES.IDEMPOTENCY_REPLAY,
  ]),
});
