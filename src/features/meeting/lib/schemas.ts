import { z } from "zod";

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

const requiredNameLike = z
  .string()
  .trim()
  .min(1, "forms.errors.required")
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/, "forms.errors.name");
const meetingPhone = z
  .string()
  .trim()
  .min(1, "forms.errors.phoneRequired")
  .regex(/^\+?[0-9]+$/, "forms.errors.phone");

export const meetingReasons = ["project", "job", "general"] as const;

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

export type MeetingFromServiceValues = z.infer<typeof meetingFromServiceSchema>;
export type MeetingFromContactValues = z.infer<typeof meetingFromContactSchema>;
export type AvailabilityQueryValues = z.infer<typeof availabilityQuerySchema>;
