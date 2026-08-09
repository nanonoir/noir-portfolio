import { z } from "zod";

export const generalContactFormSchema = z.object({
  email: z.string().trim().email("forms.errors.email"),
  message: z.string().trim().min(10, "forms.errors.messageMin"),
});

export type GeneralContactFormValues = z.infer<typeof generalContactFormSchema>;
