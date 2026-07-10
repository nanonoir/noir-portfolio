"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, FormError, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import { MeetingCalendar, type AvailabilityState } from "./meeting-calendar";
import { MeetingError } from "./meeting-error";
import { MeetingSlots } from "./meeting-slots";
import { MeetingSuccess } from "./meeting-success";
import { createWhatsAppUrl } from "./whatsapp-link";
import { meetingFromContactSchema, type MeetingFromContactValues } from "./schemas";
import { scrollToFirstError } from "./service-form-fields";

type MeetingStep = "form" | "loading" | "success" | "error";

type MeetingModalProps = {
  closeLabel?: string;
  dictionary: Dictionary;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  service?: unknown | null;
  values?: Record<string, unknown> | null;
};

const INITIAL_AVAILABILITY: AvailabilityState = { status: "idle", slots: [] };

const CONTACT_REASON_LABELS: Record<MeetingFromContactValues["reason"], string> = {
  project: "Proyecto / servicio",
  job: "Oportunidad laboral",
  general: "Consulta general",
};

type ContactMeetingPayload = {
  type: "meeting_request";
  origin: "Contacto";
  reason: string;
  name: string;
  email: string;
  phone: string;
  message?: string;
  meeting: {
    date: string;
    time: string;
  };
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) return undefined;

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

function createMeetingWhatsAppMessage(values: Partial<MeetingFromContactValues>, dictionary: Dictionary) {
  const reason = values.reason ? dictionary.meeting.reasons[values.reason] : dictionary.forms.success.emptyMessageFallback;
  const message = values.message?.trim() || dictionary.forms.success.emptyMessageFallback;
  const schedule = values.date && values.time ? `${values.date} ${values.time}` : dictionary.forms.success.emptyMessageFallback;

  return [
    "Hola Nahuel, quiero solicitar una reunión.",
    "",
    `Nombre: ${values.name || dictionary.forms.success.emptyMessageFallback}`,
    `Correo: ${values.email || dictionary.forms.success.emptyMessageFallback}`,
    `WhatsApp: ${values.phone || dictionary.forms.success.emptyMessageFallback}`,
    `Motivo: ${reason}`,
    `Horario solicitado: ${schedule}`,
    "",
    `Mensaje: ${message}`,
  ].join("\n");
}

function buildContactMeetingPayload(values: MeetingFromContactValues): ContactMeetingPayload {
  const message = values.message?.trim();

  return {
    type: "meeting_request",
    origin: "Contacto",
    reason: CONTACT_REASON_LABELS[values.reason],
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    ...(message ? { message } : {}),
    meeting: {
      date: values.date,
      time: values.time,
    },
  };
}

function FieldError({ dictionary, id, message }: { dictionary: Dictionary; id: string; message?: string }) {
  return <FormError id={id}>{translateError(dictionary, message)}</FormError>;
}

export function MeetingModal({ closeLabel, dictionary, isOpen, onClose }: MeetingModalProps) {
  const [step, setStep] = useState<MeetingStep>("form");
  const [availability, setAvailability] = useState<AvailabilityState>(INITIAL_AVAILABILITY);
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm<MeetingFromContactValues>({
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
    resolver: zodResolver(meetingFromContactSchema),
  });
  const errors = form.formState.errors;
  const watchedValues = useWatch({ control: form.control });
  const selectedDate = watchedValues.date || "";
  const selectedTime = watchedValues.time || "";
  const whatsAppMessage = useMemo(
    () => createMeetingWhatsAppMessage(watchedValues, dictionary),
    [dictionary, watchedValues],
  );
  const whatsAppUrl = useMemo(() => createWhatsAppUrl(whatsAppMessage), [whatsAppMessage]);

  const resetSlot = useCallback(() => {
    form.setValue("time", "", { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const handleDateChange = useCallback((date: string) => {
    form.setValue("date", date, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const handleSlotSelect = useCallback((time: string) => {
    form.setValue("time", time, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const retryAvailability = useCallback(() => {
    if (!selectedDate) return;

    const currentDate = selectedDate;
    setAvailability({ status: "loading", slots: [] });

    fetch(`/api/availability?date=${encodeURIComponent(currentDate)}`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || dictionary.meeting.availability.error);
        }

        const slots = Array.isArray(data.slots) ? data.slots : [];
        setAvailability({ status: slots.length > 0 ? "success" : "empty", slots });
      })
      .catch((error: Error) => {
        setAvailability({ status: "error", slots: [], message: error.message || dictionary.meeting.availability.error });
      });
  }, [dictionary.meeting.availability.error, selectedDate]);

  async function handleSubmit(values: MeetingFromContactValues) {
    setSubmitError(undefined);
    setStep("loading");

    try {
      const response = await fetch("/api/meeting", {
        body: JSON.stringify(buildContactMeetingPayload(values)),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || dictionary.meeting.error.message);
      }

      setStep("success");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : dictionary.meeting.error.message);
      setStep("error");
    }
  }

  function handleRetry() {
    void form.handleSubmit(handleSubmit, scrollToFirstError)();
  }

  function handleClose() {
    setStep("form");
    setAvailability(INITIAL_AVAILABILITY);
    setSubmitError(undefined);
    form.reset();
    onClose();
  }

  const footer = step === "form" ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      <Button variant="outlined" onClick={handleClose}>{dictionary.meeting.actions.close}</Button>
      <Button disabled={availability.status === "loading"} form="meeting-contact-form" type="submit">
        {dictionary.meeting.actions.confirm}
      </Button>
    </div>
  ) : null;

  return (
    <Modal
      closeLabel={closeLabel || dictionary.modals.closeLabel}
      footer={footer}
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={dictionary.meeting.title}
    >
      {step === "success" ? (
        <MeetingSuccess dictionary={dictionary} onClose={handleClose} />
      ) : step === "error" ? (
        <MeetingError dictionary={dictionary} message={submitError} onRetry={handleRetry} whatsappMessage={whatsAppMessage} />
      ) : (
        <form
          className="space-y-5"
          id="meeting-contact-form"
          noValidate
          onSubmit={form.handleSubmit(handleSubmit, scrollToFirstError)}
        >
          <div className="space-y-2">
            <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
              {dictionary.meeting.descriptionFromContact}
            </p>
            <p className="rounded-2xl border border-border bg-surface/30 px-4 py-3 text-base leading-7 text-muted-foreground md:text-sm md:leading-6">
              {dictionary.meeting.disclaimer}
            </p>
          </div>

          {Object.keys(errors).length > 0 && form.formState.isSubmitted ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-base text-red-500 md:text-sm" role="alert">
              {dictionary.forms.common.requiredFieldsMessage}
            </div>
          ) : null}

          {step === "loading" ? (
            <div className="rounded-2xl border border-border bg-surface/30 px-4 py-4 text-base text-body-foreground md:text-sm" role="status">
              {dictionary.meeting.actions.confirm}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" required>{dictionary.meeting.fields.name}</Label>
              <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
              <FieldError dictionary={dictionary} id="name-error" message={errors.name?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" required>{dictionary.meeting.fields.email}</Label>
              <Input id="email" autoComplete="email" type="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
              <FieldError dictionary={dictionary} id="email-error" message={errors.email?.message} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone" required>{dictionary.meeting.fields.phone}</Label>
              <Input id="phone" autoComplete="tel" inputMode="tel" type="tel" aria-invalid={Boolean(errors.phone)} {...form.register("phone")} />
              <FieldError dictionary={dictionary} id="phone-error" message={errors.phone?.message} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reason" required>{dictionary.meeting.fields.reason}</Label>
              <Select id="reason" aria-invalid={Boolean(errors.reason)} {...form.register("reason")}>
                <option value="">{dictionary.meeting.fields.reason}</option>
                <option value="project">{dictionary.meeting.reasons.project}</option>
                <option value="job">{dictionary.meeting.reasons.job}</option>
                <option value="general">{dictionary.meeting.reasons.general}</option>
              </Select>
              <FieldError dictionary={dictionary} id="reason-error" message={errors.reason?.message} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="message">{dictionary.meeting.fields.message}</Label>
              <Textarea id="message" aria-invalid={Boolean(errors.message)} {...form.register("message")} />
              <FieldError dictionary={dictionary} id="message-error" message={errors.message?.message} />
            </div>

            <div className="sm:col-span-2">
              <MeetingCalendar
                dictionary={dictionary}
                error={errors.date?.message}
                onAvailabilityChange={setAvailability}
                onChange={handleDateChange}
                onSlotReset={resetSlot}
                value={selectedDate}
              />
            </div>

            <div className="sm:col-span-2">
              <MeetingSlots
                dictionary={dictionary}
                error={errors.time?.message}
                onRetry={retryAvailability}
                onSelect={handleSlotSelect}
                selectedTime={selectedTime}
                state={availability}
                whatsappUrl={whatsAppUrl}
              />
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
