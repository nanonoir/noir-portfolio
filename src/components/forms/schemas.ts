import { z } from "zod";

const requiredText = z.string().trim().min(1, "forms.errors.required");
const requiredNameLike = z
  .string()
  .trim()
  .min(1, "forms.errors.required")
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/, "forms.errors.name");
const phone = z
  .string()
  .trim()
  .min(1, "forms.errors.required")
  .regex(/^\+?[0-9]+$/, "forms.errors.phone");
const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalMessage = z.string().trim().max(500, "forms.errors.messageMax").optional().or(z.literal(""));

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const meetingDate = z
  .string()
  .trim()
  .min(1, "forms.errors.dateRequired")
  .regex(datePattern, "forms.errors.dateRequired")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "forms.errors.dateRequired");

const meetingTime = z
  .string()
  .trim()
  .min(1, "forms.errors.timeRequired")
  .regex(timePattern, "forms.errors.timeRequired");

export const ianaTimeZone = z
  .string()
  .trim()
  .min(1, "forms.errors.timezoneRequired")
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "forms.errors.timezoneRequired");

export const availabilityQuerySchema = z.object({
  date: meetingDate,
  timezone: ianaTimeZone,
});

const meetingPhone = z
  .string()
  .trim()
  .min(1, "forms.errors.phoneRequired")
  .regex(/^\+?[0-9]+$/, "forms.errors.phone");

export const meetingReasons = ["project", "job", "general"] as const;

const contactFields = {
  name: requiredNameLike,
  email: z.string().trim().email("forms.errors.email"),
  phone,
};

export const auditFormSchema = z.object({
  websiteUrl: z.url("forms.errors.url"),
  ...contactFields,
  message: optionalMessage,
});

export const landingProjectTypes = ["personal", "business"] as const;

export const landingFormSchema = z
  .object({
    ...contactFields,
    projectType: z.enum(landingProjectTypes, "forms.errors.required"),
    brandName: optionalText,
    social: optionalText,
    message: optionalMessage,
  })
  .superRefine((data, context) => {
    if (data.projectType === "business" && !data.brandName?.trim()) {
      context.addIssue({
        code: "custom",
        message: "forms.errors.brandRequired",
        path: ["brandName"],
      });
    }
  });

export const ecommerceFormSchema = z.object({
  ...contactFields,
  brandName: requiredText,
  social: optionalText,
  message: optionalMessage,
});

export const automationTypes = ["customer-service", "business-processes", "other"] as const;

export const automationFormSchema = z.object({
  ...contactFields,
  brandName: requiredText,
  automationType: z.enum(automationTypes, "forms.errors.required"),
  message: optionalMessage,
});

export const customServiceFormSchema = z.object({
  ...contactFields,
  business: optionalText,
  social: optionalText,
  budget: optionalText,
  message: optionalMessage,
});

export const generalContactFormSchema = z.object({
  email: z.string().trim().email("forms.errors.email"),
  message: z.string().trim().min(10, "forms.errors.messageMin"),
});

export const meetingFromServiceSchema = z.object({
  date: meetingDate,
  time: meetingTime,
  message: optionalMessage,
});

export const meetingFromContactSchema = z.object({
  name: requiredNameLike,
  email: z.string().trim().email("forms.errors.email"),
  phone: meetingPhone,
  reason: z.enum(meetingReasons, "forms.errors.reasonRequired"),
  message: optionalMessage,
  date: meetingDate,
  time: meetingTime,
});

export type AuditFormValues = z.infer<typeof auditFormSchema>;
export type LandingFormValues = z.infer<typeof landingFormSchema>;
export type EcommerceFormValues = z.infer<typeof ecommerceFormSchema>;
export type AutomationFormValues = z.infer<typeof automationFormSchema>;
export type CustomServiceFormValues = z.infer<typeof customServiceFormSchema>;
export type GeneralContactFormValues = z.infer<typeof generalContactFormSchema>;
export type MeetingFromServiceValues = z.infer<typeof meetingFromServiceSchema>;
export type MeetingFromContactValues = z.infer<typeof meetingFromContactSchema>;
export type AvailabilityQueryValues = z.infer<typeof availabilityQuerySchema>;

export const serviceFormSchemas = {
  "web-audit": auditFormSchema,
  landing: landingFormSchema,
  ecommerce: ecommerceFormSchema,
  automation: automationFormSchema,
  custom: customServiceFormSchema,
} as const;

export type ServiceFormId = keyof typeof serviceFormSchemas;
