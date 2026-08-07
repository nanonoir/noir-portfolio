"use client";

import type { FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Dictionary } from "@/lib/i18n";
import { Button, FormError, HandwrittenIcon, Label, Select } from "@/components/ui";
import type { MeetingFormValues } from "./meeting-payload-mapper";
import { TextAreaField, TextField } from "./service-form-fields";

type MeetingModalFormProps = {
  dictionary: Dictionary;
  form: UseFormReturn<MeetingFormValues>;
  formId: string;
  isContactOrigin: boolean;
  isLoading: boolean;
  onOpenDateTime: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selectedDate: string;
  selectedTime: string;
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) return undefined;

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

function FieldError({ dictionary, id, message }: { dictionary: Dictionary; id: string; message?: string }) {
  return <FormError id={id}>{translateError(dictionary, message)}</FormError>;
}

export function MeetingModalForm({
  dictionary,
  form,
  formId,
  isContactOrigin,
  isLoading,
  onOpenDateTime,
  onSubmit,
  selectedDate,
  selectedTime,
}: MeetingModalFormProps) {
  const errors = form.formState.errors;

  return (
    <form className="space-y-5" id={formId} noValidate onSubmit={onSubmit}>
      <div className="space-y-2">
        <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
          {isContactOrigin ? dictionary.meeting.descriptionFromContact : dictionary.meeting.descriptionFromService}
        </p>
      </div>

      {Object.keys(errors).length > 0 && form.formState.isSubmitted ? (
        <div className="status-danger flex items-start gap-2 rounded-2xl px-4 py-3 text-base md:text-sm" role="alert" aria-live="assertive">
          <HandwrittenIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" icon="warning" />
          <span>{dictionary.forms.common.requiredFieldsMessage}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface/30 px-4 py-4 text-base text-body-foreground md:text-sm" role="status" aria-live="polite">
          {dictionary.meeting.actions.loading}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 md:grid-cols-2 md:items-start">
        <div className="min-w-0 space-y-4">
          {isContactOrigin ? (
            <>
              <TextField dictionary={dictionary} error={errors.name?.message} label={dictionary.meeting.fields.name} name="name" placeholder={dictionary.forms.common.namePlaceholder} registration={form.register("name")} required variant="name" />
              <TextField autoComplete="email" dictionary={dictionary} error={errors.email?.message} label={dictionary.meeting.fields.email} name="email" placeholder={dictionary.forms.common.emailPlaceholder} registration={form.register("email")} required type="email" />
              <TextField dictionary={dictionary} error={errors.phone?.message} label={dictionary.meeting.fields.phone} name="phone" placeholder={dictionary.forms.common.phonePlaceholder} registration={form.register("phone")} required type="tel" variant="phone" />
              <div className="space-y-2">
                <Label htmlFor="reason" required>{dictionary.meeting.fields.reason}</Label>
                <Select id="reason" aria-describedby={errors.reason ? "reason-error" : undefined} aria-invalid={Boolean(errors.reason)} {...form.register("reason")}>
                  <option value="">{dictionary.meeting.fields.reason}</option>
                  <option value="project">{dictionary.meeting.reasons.project}</option>
                  <option value="job">{dictionary.meeting.reasons.job}</option>
                  <option value="general">{dictionary.meeting.reasons.general}</option>
                </Select>
                <FieldError dictionary={dictionary} id="reason-error" message={errors.reason?.message} />
              </div>
            </>
          ) : null}

          <TextAreaField dictionary={dictionary} error={errors.message?.message} label={dictionary.meeting.fields.message} name="message" placeholder={dictionary.forms.common.messagePlaceholder} registration={form.register("message")} />
        </div>

        <div className="min-w-0 space-y-3">
          <div aria-live="polite" className="rounded-2xl border border-border bg-surface/20 px-4 py-4" role="group">
            <p className="text-sm font-medium text-foreground">{dictionary.meeting.fields.date} / {dictionary.meeting.fields.time}</p>
            <p className="mt-1 text-base text-body-foreground md:text-sm">{selectedDate && selectedTime ? `${selectedDate} · ${selectedTime}` : dictionary.meeting.dateTime.open}</p>
            <Button
              aria-describedby={errors.date || errors.time ? "meeting-date-time-error" : undefined}
              aria-invalid={Boolean(errors.date || errors.time)}
              className="mt-3"
              data-field-id="date time"
              icon={<HandwrittenIcon className="size-4" icon="calendar" />}
              iconPosition="start"
              id="meeting-date-time-selector"
              onClick={onOpenDateTime}
              type="button"
              variant="outlined"
            >
              {dictionary.meeting.dateTime.open}
            </Button>
          </div>
          {errors.date?.message || errors.time?.message ? <FieldError dictionary={dictionary} id="meeting-date-time-error" message={errors.date?.message || errors.time?.message} /> : null}
        </div>
      </div>
    </form>
  );
}
