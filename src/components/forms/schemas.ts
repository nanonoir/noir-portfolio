import { z } from "zod";

const requiredText = z.string().trim().min(1, "forms.errors.required");
const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalMessage = z.string().trim().max(500, "forms.errors.messageMax").optional().or(z.literal(""));

const contactFields = {
  name: requiredText,
  email: z.string().trim().email("forms.errors.email"),
  phone: requiredText,
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

export type AuditFormValues = z.infer<typeof auditFormSchema>;
export type LandingFormValues = z.infer<typeof landingFormSchema>;
export type EcommerceFormValues = z.infer<typeof ecommerceFormSchema>;
export type AutomationFormValues = z.infer<typeof automationFormSchema>;
export type CustomServiceFormValues = z.infer<typeof customServiceFormSchema>;
export type GeneralContactFormValues = z.infer<typeof generalContactFormSchema>;

export const serviceFormSchemas = {
  "web-audit": auditFormSchema,
  landing: landingFormSchema,
  ecommerce: ecommerceFormSchema,
  automation: automationFormSchema,
  custom: customServiceFormSchema,
} as const;

export type ServiceFormId = keyof typeof serviceFormSchemas;
