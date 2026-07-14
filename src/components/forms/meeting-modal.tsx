"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, FormError, Label, Modal, Select } from "@/components/ui";
import { DateTimeModal } from "./date-time-modal";
import { MeetingError } from "./meeting-error";
import { buildMeetingPayload, type MeetingFormValues } from "./meeting-payload-mapper";
import { MeetingSuccess } from "./meeting-success";
import { createWhatsAppUrl, type ServiceRequestValues } from "./whatsapp-link";
import {
  meetingFromContactSchema,
  meetingFromServiceSchema,
} from "./schemas";
import { scrollToFirstError } from "./service-form-fields";
import { TextAreaField, TextField } from "./service-form-fields";
import type { ServiceRequestTarget } from "./service-request-modal";

type MeetingStep = "form" | "loading" | "success" | "error";

type MeetingModalProps = {
  closeLabel?: string;
  dictionary: Dictionary;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  /**
   * Called when the user completes the meeting request (success state closed).
   * If provided, the success close triggers this instead of onClose, so the
   * parent can distinguish "mid-flow dismiss" from "completed" and react
   * accordingly (e.g. close both parent and child modals).
   */
  onComplete?: () => void;
  origin?: "contact" | "service" | "custom";
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
};

type MeetingApiError = {
  error?: string;
  message?: string;
  success?: false;
};

type MeetingErrorState = {
  code?: string;
  message: string;
};

type IdempotencyBinding = {
  fingerprint: string;
  key: string;
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) return undefined;

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

function createMeetingWhatsAppMessage({
  dictionary,
  language,
  origin,
  previousValues,
  service,
  values,
}: {
  dictionary: Dictionary;
  language: Language;
  origin: MeetingModalProps["origin"];
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
  values: Partial<MeetingFormValues>;
}) {
  const empty = dictionary.forms.success.emptyMessageFallback;
  const contactName = values.name || previousValues?.name || empty;
  const contactEmail = values.email || previousValues?.email || empty;
  const contactPhone = values.phone || previousValues?.phone || empty;
  const reason = values.reason
    ? dictionary.meeting.reasons[values.reason]
    : service?.title[language] || dictionary.meeting.title;
  const message = values.message?.trim() || previousValues?.message?.trim() || empty;
  const schedule = values.date && values.time ? `${values.date} ${values.time}` : empty;

  if (origin === "contact") {
    return [
      dictionary.meeting.whatsapp.intro,
      "",
      `${dictionary.meeting.whatsapp.name}: ${contactName}`,
      `${dictionary.meeting.whatsapp.email}: ${contactEmail}`,
      `${dictionary.meeting.whatsapp.phone}: ${contactPhone}`,
      `${dictionary.meeting.whatsapp.reason}: ${reason}`,
      `${dictionary.meeting.whatsapp.schedule}: ${schedule}`,
      "",
      `${dictionary.meeting.whatsapp.message}: ${message}`,
    ].join("\n");
  }

  return [
    dictionary.meeting.whatsapp.intro,
    "",
    `${dictionary.meeting.whatsapp.service}: ${reason}`,
    `${dictionary.meeting.whatsapp.name}: ${contactName}`,
    `${dictionary.meeting.whatsapp.email}: ${contactEmail}`,
    `${dictionary.meeting.whatsapp.phone}: ${contactPhone}`,
    `${dictionary.meeting.whatsapp.schedule}: ${schedule}`,
    "",
    `${dictionary.meeting.whatsapp.message}: ${message}`,
  ].join("\n");
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value) ?? "undefined";

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function createIdempotencyFingerprint({
  origin,
  previousValues,
  service,
  values,
}: {
  origin: MeetingModalProps["origin"];
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
  values: MeetingFormValues;
}) {
  return stableSerialize({
    origin,
    previousValues,
    service: service?.id ?? null,
    values: {
      date: values.date,
      email: values.email,
      message: values.message,
      name: values.name,
      phone: values.phone,
      reason: values.reason,
      time: values.time,
    },
  });
}

function FieldError({ dictionary, id, message }: { dictionary: Dictionary; id: string; message?: string }) {
  return <FormError id={id}>{translateError(dictionary, message)}</FormError>;
}

export function MeetingModal({
  closeLabel,
  dictionary,
  isOpen,
  language,
  onClose,
  onComplete,
  origin = "contact",
  previousValues,
  service,
}: MeetingModalProps) {
  const isContactOrigin = origin === "contact";
  const [step, setStep] = useState<MeetingStep>("form");
  const [dateTimeOpen, setDateTimeOpen] = useState(false);
  const [idempotencyBinding, setIdempotencyBinding] = useState<IdempotencyBinding>();
  const [submitError, setSubmitError] = useState<MeetingErrorState>();
  const form = useForm<MeetingFormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      reason: undefined,
      message: "",
      date: "",
      time: "",
    },
    mode: "onBlur",
    resolver: zodResolver(isContactOrigin ? meetingFromContactSchema : meetingFromServiceSchema) as Resolver<MeetingFormValues>,
  });
  const errors = form.formState.errors;
  const selectedDate = useWatch({ control: form.control, name: "date" }) || "";
  const selectedTime = useWatch({ control: form.control, name: "time" }) || "";
  const isSubmittingMeeting = step === "loading";
  const whatsAppMessage = createMeetingWhatsAppMessage({
    dictionary,
    language,
    origin,
    previousValues,
    service,
    values: form.getValues(),
  });
  const whatsAppUrl = createWhatsAppUrl(whatsAppMessage);

  const handleDateTimeConfirm = useCallback(({ date, time }: { date: string; time: string }) => {
    form.setValue("date", date, { shouldDirty: true, shouldValidate: true });
    form.setValue("time", time, { shouldDirty: true, shouldValidate: true });
    setDateTimeOpen(false);
  }, [form]);

  function buildPayload(values: MeetingFormValues, key: string) {
    return buildMeetingPayload({
      idempotencyKey: key,
      language,
      origin,
      previousValues,
      service,
      values,
    });
  }

  async function handleSubmit(values: MeetingFormValues) {
    const fingerprint = createIdempotencyFingerprint({ origin, previousValues, service, values });
    const key = idempotencyBinding?.fingerprint === fingerprint
      ? idempotencyBinding.key
      : crypto.randomUUID();

    setIdempotencyBinding({ fingerprint, key });
    setSubmitError(undefined);
    setStep("loading");

    try {
      const response = await fetch("/api/meeting", {
        body: JSON.stringify(buildPayload(values, key)),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const apiError = data as MeetingApiError;
        const code = apiError.error;

        console.warn("Meeting request failed", { code });
        setSubmitError({
          code,
          message: code === "SLOT_UNAVAILABLE"
            ? dictionary.meeting.error.slotUnavailable
            : dictionary.meeting.error.message,
        });
        setStep("error");
        return;
      }

      setStep("success");
    } catch (error) {
      setSubmitError({ message: error instanceof Error ? error.message : dictionary.meeting.error.message });
      setStep("error");
    }
  }

  function handleRetry() {
    void form.handleSubmit(handleSubmit, scrollToFirstError)();
  }

  function handleBackToForm() {
    setSubmitError(undefined);
    setStep("form");
  }

  function handleClose() {
    setStep("form");
    setDateTimeOpen(false);
    setSubmitError(undefined);
    setIdempotencyBinding(undefined);
    form.reset();
    onClose();
  }

  function handleSuccessClose() {
    setStep("form");
    setDateTimeOpen(false);
    setSubmitError(undefined);
    setIdempotencyBinding(undefined);
    form.reset();
    // If a completion handler is provided (nested service flow), call it so the
    // parent service modal can also close. Otherwise fall back to onClose.
    if (onComplete) {
      onComplete();
    } else {
      onClose();
    }
  }

  /**
   * Universal dismiss handler passed to Modal's onClose, X button, and
   * backdrop. Routes to handleSuccessClose when the user has already
   * completed a meeting request, so ALL dismiss paths (X, backdrop, Escape,
   * explicit Close button) trigger the correct completion signal.
   */
  function handleDismiss() {
    if (step === "success") {
      handleSuccessClose();
    } else {
      handleClose();
    }
  }

  const formId = isContactOrigin ? "meeting-contact-form" : "meeting-service-form";
  const footer = step === "form" ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
       <Button className="hidden md:inline-flex" variant="outlined" onClick={handleClose}>{dictionary.meeting.actions.close}</Button>
      <Button disabled={isSubmittingMeeting} form={formId} type="submit">
        {dictionary.meeting.actions.confirm}
      </Button>
    </div>
  ) : null;

  return (
    <>
      <Modal
        closeLabel={closeLabel || dictionary.modals.closeLabel}
        footer={footer}
        isOpen={isOpen}
        onClose={handleDismiss}
        size="lg"
        title={dictionary.meeting.title}
      >
        {step === "success" ? (
          <MeetingSuccess dictionary={dictionary} onClose={handleSuccessClose} whatsappUrl={isContactOrigin ? undefined : whatsAppUrl} />
        ) : step === "error" ? (
          <MeetingError code={submitError?.code} dictionary={dictionary} message={submitError?.message} onBackToForm={handleBackToForm} onRetry={handleRetry} whatsappMessage={whatsAppMessage} />
        ) : (
          <form
            className="space-y-5"
            id={formId}
            noValidate
            onSubmit={form.handleSubmit(handleSubmit, scrollToFirstError)}
          >
            <div className="space-y-2">
              <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
                {isContactOrigin ? dictionary.meeting.descriptionFromContact : dictionary.meeting.descriptionFromService}
              </p>
            </div>

            {Object.keys(errors).length > 0 && form.formState.isSubmitted ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-base text-red-500 md:text-sm" role="alert" aria-live="assertive">
                {dictionary.forms.common.requiredFieldsMessage}
              </div>
            ) : null}

            {step === "loading" ? (
              <div className="rounded-2xl border border-border bg-surface/30 px-4 py-4 text-base text-body-foreground md:text-sm" role="status" aria-live="polite">
                {dictionary.meeting.actions.loading}
              </div>
            ) : null}

            <div className="grid min-w-0 gap-5 md:grid-cols-2 md:items-start">
              <div className="min-w-0 space-y-4">
                {isContactOrigin ? (
                  <>
                    <TextField
                      dictionary={dictionary}
                      error={errors.name?.message}
                      label={dictionary.meeting.fields.name}
                      name="name"
                      placeholder={dictionary.forms.common.namePlaceholder}
                      registration={form.register("name")}
                      required
                      variant="name"
                    />

                    <TextField
                      autoComplete="email"
                      dictionary={dictionary}
                      error={errors.email?.message}
                      label={dictionary.meeting.fields.email}
                      name="email"
                      placeholder={dictionary.forms.common.emailPlaceholder}
                      registration={form.register("email")}
                      required
                      type="email"
                    />

                    <TextField
                      dictionary={dictionary}
                      error={errors.phone?.message}
                      label={dictionary.meeting.fields.phone}
                      name="phone"
                      placeholder={dictionary.forms.common.phonePlaceholder}
                      registration={form.register("phone")}
                      required
                      type="tel"
                      variant="phone"
                    />

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

                <TextAreaField
                  dictionary={dictionary}
                  error={errors.message?.message}
                  label={dictionary.meeting.fields.message}
                  name="message"
                  placeholder={dictionary.forms.common.messagePlaceholder}
                  registration={form.register("message")}
                />
              </div>

              <div className="min-w-0 space-y-3">
                <div
                  aria-describedby={errors.date || errors.time ? "meeting-date-time-error" : undefined}
                  aria-live="polite"
                  className="rounded-2xl border border-border bg-surface/20 px-4 py-4"
                  role="group"
                >
                  <p className="text-sm font-medium text-foreground">{dictionary.meeting.fields.date} / {dictionary.meeting.fields.time}</p>
                  <p className="mt-1 text-base text-body-foreground md:text-sm">
                    {selectedDate && selectedTime ? `${selectedDate} · ${selectedTime}` : dictionary.meeting.dateTime.open}
                  </p>
                  <Button className="mt-3" type="button" variant="outlined" onClick={() => setDateTimeOpen(true)}>
                    {dictionary.meeting.dateTime.open}
                  </Button>
                </div>
                {(errors.date?.message || errors.time?.message) ? (
                  <FieldError dictionary={dictionary} id="meeting-date-time-error" message={errors.date?.message || errors.time?.message} />
                ) : null}
              </div>
            </div>
          </form>
        )}
      </Modal>

      {dateTimeOpen ? (
        <DateTimeModal
          closeLabel={closeLabel || dictionary.modals.closeLabel}
          dictionary={dictionary}
          initialDate={selectedDate}
          initialTime={selectedTime}
          isOpen={dateTimeOpen}
          language={language}
          onClose={() => setDateTimeOpen(false)}
          onConfirm={handleDateTimeConfirm}
          whatsappUrl={whatsAppUrl}
        />
      ) : null}
    </>
  );
}
