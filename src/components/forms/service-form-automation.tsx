"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { automationFormSchema, type AutomationFormValues } from "./schemas";
import { RadioGroup, RequestFormShell, scrollToFirstError, TextAreaField, TextField } from "./service-form-fields";

type ServiceFormProps<TValues> = {
  dictionary: Dictionary;
  formId?: string;
  onSubmit: (values: TValues) => void;
};

export function ServiceFormAutomation({ dictionary, formId, onSubmit }: ServiceFormProps<AutomationFormValues>) {
  const form = useForm<AutomationFormValues>({ mode: "onBlur", resolver: zodResolver(automationFormSchema) });
  const errors = form.formState.errors;

  return (
    <RequestFormShell dictionary={dictionary} formId={formId} hasErrors={Object.keys(errors).length > 0 && form.formState.isSubmitted} isSubmitting={form.formState.isSubmitting} onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField dictionary={dictionary} error={errors.name?.message} label={dictionary.forms.common.name} name="name" placeholder={dictionary.forms.common.namePlaceholder} registration={form.register("name")} required variant="name" />
        <TextField dictionary={dictionary} error={errors.email?.message} label={dictionary.forms.common.email} name="email" placeholder={dictionary.forms.common.emailPlaceholder} registration={form.register("email")} required type="email" />
        <TextField dictionary={dictionary} error={errors.phone?.message} label={dictionary.forms.common.phone} name="phone" placeholder={dictionary.forms.common.phonePlaceholder} registration={form.register("phone")} required type="tel" variant="phone" />
        <TextField dictionary={dictionary} error={errors.brandName?.message} label={dictionary.forms.fields.brandName} name="brandName" placeholder={dictionary.forms.fields.brandNamePlaceholder} registration={form.register("brandName")} required variant="name" />
        <RadioGroup
          dictionary={dictionary}
          error={errors.automationType?.message}
          legend={dictionary.forms.fields.automationType}
          name="automationType"
          options={[
            { label: dictionary.forms.fields.automationCustomerService, value: "customer-service" },
            { label: dictionary.forms.fields.automationBusinessProcesses, value: "business-processes" },
            { label: dictionary.forms.fields.automationOther, value: "other" },
          ]}
          registration={form.register("automationType")}
          required
          wrapperClassName="col-span-full"
        />
        <TextAreaField dictionary={dictionary} error={errors.message?.message} label={dictionary.forms.common.message} name="message" placeholder={dictionary.forms.common.messagePlaceholder} registration={form.register("message")} wrapperClassName="col-span-full" />
      </div>
    </RequestFormShell>
  );
}
