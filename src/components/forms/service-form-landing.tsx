"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { landingFormSchema, type LandingFormValues } from "./schemas";
import { RadioGroup, RequestFormShell, scrollToFirstError, TextAreaField, TextField } from "./service-form-fields";

type ServiceFormProps<TValues> = {
  dictionary: Dictionary;
  onSubmit: (values: TValues) => void;
};

export function ServiceFormLanding({ dictionary, onSubmit }: ServiceFormProps<LandingFormValues>) {
  const form = useForm<LandingFormValues>({ mode: "onBlur", resolver: zodResolver(landingFormSchema) });
  const errors = form.formState.errors;
  const projectType = useWatch({ control: form.control, name: "projectType" });

  return (
    <RequestFormShell
      dictionary={dictionary}
      hasErrors={Object.keys(errors).length > 0 && form.formState.isSubmitted}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField dictionary={dictionary} error={errors.name?.message} label={dictionary.forms.common.name} name="name" placeholder={dictionary.forms.common.namePlaceholder} registration={form.register("name")} required />
        <TextField dictionary={dictionary} error={errors.email?.message} label={dictionary.forms.common.email} name="email" placeholder={dictionary.forms.common.emailPlaceholder} registration={form.register("email")} required type="email" />
        <TextField dictionary={dictionary} error={errors.phone?.message} label={dictionary.forms.common.phone} name="phone" placeholder={dictionary.forms.common.phonePlaceholder} registration={form.register("phone")} required type="tel" />
        <RadioGroup
          dictionary={dictionary}
          error={errors.projectType?.message}
          legend={dictionary.forms.fields.projectType}
          name="projectType"
          options={[
            { label: dictionary.forms.fields.projectTypePersonal, value: "personal" },
            { label: dictionary.forms.fields.projectTypeBusiness, value: "business" },
          ]}
          registration={form.register("projectType")}
          required
        />
        {projectType === "business" ? (
          <TextField dictionary={dictionary} error={errors.brandName?.message} label={dictionary.forms.fields.brandName} name="brandName" placeholder={dictionary.forms.fields.brandNamePlaceholder} registration={form.register("brandName")} required wrapperClassName="col-span-full" />
        ) : null}
        <TextField dictionary={dictionary} error={errors.social?.message} label={dictionary.forms.fields.social} name="social" placeholder={dictionary.forms.fields.socialPlaceholder} registration={form.register("social")} wrapperClassName="col-span-full" />
        <TextAreaField dictionary={dictionary} error={errors.message?.message} label={dictionary.forms.common.message} name="message" placeholder={dictionary.forms.common.messagePlaceholder} registration={form.register("message")} wrapperClassName="col-span-full" />
      </div>
    </RequestFormShell>
  );
}
