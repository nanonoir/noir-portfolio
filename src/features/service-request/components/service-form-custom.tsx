"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { customServiceFormSchema, type CustomServiceFormValues } from "../lib/schemas";
import { RequestFormShell, scrollToFirstError, TextAreaField, TextField } from "./service-form-fields";

type ServiceFormProps<TValues> = {
  dictionary: Dictionary;
  formId?: string;
  onSubmit: (values: TValues) => void;
};

export function ServiceFormCustom({ dictionary, formId, onSubmit }: ServiceFormProps<CustomServiceFormValues>) {
  const form = useForm<CustomServiceFormValues>({ mode: "onBlur", resolver: zodResolver(customServiceFormSchema) });
  const errors = form.formState.errors;

  return (
    <RequestFormShell dictionary={dictionary} formId={formId} hasErrors={Object.keys(errors).length > 0 && form.formState.isSubmitted} isSubmitting={form.formState.isSubmitting} onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField dictionary={dictionary} error={errors.name?.message} label={dictionary.forms.common.name} name="name" placeholder={dictionary.forms.common.namePlaceholder} registration={form.register("name")} required variant="name" />
        <TextField dictionary={dictionary} error={errors.email?.message} label={dictionary.forms.common.email} name="email" placeholder={dictionary.forms.common.emailPlaceholder} registration={form.register("email")} required type="email" />
        <TextField dictionary={dictionary} error={errors.phone?.message} label={dictionary.forms.common.phone} name="phone" placeholder={dictionary.forms.common.phonePlaceholder} registration={form.register("phone")} required type="tel" variant="phone" />
        <TextField dictionary={dictionary} error={errors.business?.message} label={dictionary.forms.fields.business} name="business" placeholder={dictionary.forms.fields.businessPlaceholder} registration={form.register("business")} variant="name" />
        <TextField dictionary={dictionary} error={errors.social?.message} label={dictionary.forms.fields.social} name="social" placeholder={dictionary.forms.fields.socialPlaceholder} registration={form.register("social")} />
        <TextField dictionary={dictionary} error={errors.budget?.message} label={dictionary.forms.fields.budget} name="budget" placeholder={dictionary.forms.fields.budgetPlaceholder} registration={form.register("budget")} />
        <TextAreaField dictionary={dictionary} error={errors.message?.message} label={dictionary.forms.common.message} name="message" placeholder={dictionary.forms.common.messagePlaceholder} registration={form.register("message")} wrapperClassName="col-span-full" />
      </div>
    </RequestFormShell>
  );
}
