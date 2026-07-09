"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { auditFormSchema, type AuditFormValues } from "./schemas";
import { RequestFormShell, scrollToFirstError, TextAreaField, TextField } from "./service-form-fields";

type ServiceFormProps<TValues> = {
  dictionary: Dictionary;
  onSubmit: (values: TValues) => void;
};

export function ServiceFormAudit({ dictionary, onSubmit }: ServiceFormProps<AuditFormValues>) {
  const form = useForm<AuditFormValues>({ mode: "onBlur", resolver: zodResolver(auditFormSchema) });
  const errors = form.formState.errors;

  return (
    <RequestFormShell
      dictionary={dictionary}
      hasErrors={Object.keys(errors).length > 0 && form.formState.isSubmitted}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}
    >
      <TextField
        dictionary={dictionary}
        error={errors.websiteUrl?.message}
        helper={dictionary.forms.fields.websiteUrlHelper}
        label={dictionary.forms.fields.websiteUrl}
        name="websiteUrl"
        placeholder={dictionary.forms.fields.websiteUrlPlaceholder}
        registration={form.register("websiteUrl")}
        required
        type="url"
      />
      <TextField
        autoComplete="name"
        dictionary={dictionary}
        error={errors.name?.message}
        label={dictionary.forms.common.name}
        name="name"
        placeholder={dictionary.forms.common.namePlaceholder}
        registration={form.register("name")}
        required
      />
      <TextField
        autoComplete="email"
        dictionary={dictionary}
        error={errors.email?.message}
        label={dictionary.forms.common.email}
        name="email"
        placeholder={dictionary.forms.common.emailPlaceholder}
        registration={form.register("email")}
        required
        type="email"
      />
      <TextField
        autoComplete="tel"
        dictionary={dictionary}
        error={errors.phone?.message}
        helper={dictionary.forms.common.phoneHelper}
        label={dictionary.forms.common.phone}
        name="phone"
        placeholder={dictionary.forms.common.phonePlaceholder}
        registration={form.register("phone")}
        required
        type="tel"
      />
      <TextAreaField
        dictionary={dictionary}
        error={errors.message?.message}
        helper={dictionary.forms.common.messageMaxHelper}
        label={dictionary.forms.common.message}
        name="message"
        placeholder={dictionary.forms.common.messagePlaceholder}
        registration={form.register("message")}
      />
    </RequestFormShell>
  );
}
