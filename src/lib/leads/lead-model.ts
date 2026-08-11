import "server-only";

import { z } from "zod";

export const LEAD_TYPES = {
  CONTACT_MESSAGE: "contact_message",
  CUSTOM_SERVICE_REQUEST: "custom_service_request",
  SERVICE_REQUEST: "service_request",
} as const;

export const SERVICE_IDS = ["web-audit", "landing", "ecommerce", "automation", "custom"] as const;

const localeSchema = z.enum(["en", "es"]);
const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
const requiredName = z.string().trim().min(1).max(160).regex(/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/);
const requiredEmail = z.string().trim().email().max(320);
const requiredPhone = z.string().trim().min(1).max(40).regex(/^\+?[0-9]+$/);
const idempotencyKey = z.string().uuid();

const baseLeadSchema = z.object({
  idempotencyKey,
  locale: localeSchema,
});

export const contactLeadSchema = baseLeadSchema.extend({
  email: requiredEmail,
  message: z.string().trim().min(10).max(2_000),
  type: z.literal(LEAD_TYPES.CONTACT_MESSAGE),
});

const serviceLeadFields = {
  automationType: optionalText,
  brandName: optionalText,
  budget: optionalText,
  business: optionalText,
  message: optionalText,
  name: requiredName,
  phone: requiredPhone,
  projectType: optionalText,
  service: z.enum(SERVICE_IDS),
  social: optionalText,
  websiteUrl: optionalText,
};

export const serviceLeadSchema = baseLeadSchema.extend({
  ...serviceLeadFields,
  email: requiredEmail,
  type: z.literal(LEAD_TYPES.SERVICE_REQUEST),
});

export const customServiceLeadSchema = baseLeadSchema.extend({
  ...serviceLeadFields,
  email: requiredEmail,
  type: z.literal(LEAD_TYPES.CUSTOM_SERVICE_REQUEST),
});

export const leadSubmissionSchema = z.discriminatedUnion("type", [
  contactLeadSchema,
  serviceLeadSchema,
  customServiceLeadSchema,
]);

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

export type LeadRecord = LeadSubmission & {
  submittedAt: string;
};
