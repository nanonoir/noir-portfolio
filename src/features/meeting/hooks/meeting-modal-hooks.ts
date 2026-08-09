"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

import type { Dictionary, Language } from "@/lib/i18n";
import { buildMeetingPayload, type MeetingFormValues } from "../lib/meeting-payload-mapper";
import {
  meetingFromContactSchema,
  meetingFromServiceSchema,
} from "../lib/schemas";
import { scrollToFirstError } from "@/features/service-request/components/service-form-fields";
import type { ServiceRequestTarget } from "@/features/service-request/components/service-request-modal";
import { createWhatsAppUrl, type ServiceRequestValues } from "@/features/service-request/lib/whatsapp-link";

export type MeetingModalOrigin = "contact" | "service" | "custom";

export type MeetingModalLifecycleInput = {
  dictionary: Dictionary;
  language: Language;
  onClose: () => void;
  onComplete?: () => void;
  origin: MeetingModalOrigin;
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
};

type MeetingApiError = {
  error?: string;
  success?: false;
};

export type MeetingErrorState = {
  code?: string;
  message: string;
};

type IdempotencyBinding = {
  fingerprint: string;
  key: string;
};

export type MeetingStep = "form" | "loading" | "success" | "error";

function createMeetingWhatsAppMessage({
  dictionary,
  language,
  origin,
  previousValues,
  service,
  values,
}: Omit<MeetingModalLifecycleInput, "onClose" | "onComplete"> & {
  values: Partial<MeetingFormValues>;
}) {
  const fallbacks = dictionary.forms.success.fallbacks;
  const contactName = values.name || previousValues?.name || fallbacks.name;
  const contactEmail = values.email || previousValues?.email || fallbacks.email;
  const contactPhone = values.phone || previousValues?.phone || fallbacks.phone;
  const reason = values.reason
    ? dictionary.meeting.reasons[values.reason]
    : service?.title[language] || dictionary.meeting.title;
  const message = values.message?.trim() || previousValues?.message?.trim() || fallbacks.message;
  const schedule = values.date && values.time
    ? `${values.date} ${values.time}`
    : `${values.date || fallbacks.date} · ${values.time || fallbacks.time}`;

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
  sessionNonce,
  values,
}: Pick<MeetingModalLifecycleInput, "origin" | "previousValues" | "service"> & {
  sessionNonce: string;
  values: MeetingFormValues;
}) {
  return stableSerialize({
    origin,
    previousValues,
    service: service?.id ?? null,
    sessionNonce,
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

export function useMeetingModalLifecycle({
  dictionary,
  language,
  onClose,
  onComplete,
  origin,
  previousValues,
  service,
}: MeetingModalLifecycleInput) {
  const isContactOrigin = origin === "contact";
  const [step, setStep] = useState<MeetingStep>("form");
  const [dateTimeOpen, setDateTimeOpen] = useState(false);
  const [idempotencyBinding, setIdempotencyBinding] = useState<IdempotencyBinding>();
  const [submitError, setSubmitError] = useState<MeetingErrorState>();
  const [sessionNonce, setSessionNonce] = useState(() => crypto.randomUUID());
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
  const selectedDate = useWatch({ control: form.control, name: "date" }) || "";
  const selectedTime = useWatch({ control: form.control, name: "time" }) || "";
  const whatsAppMessage = createMeetingWhatsAppMessage({
    dictionary,
    language,
    origin,
    previousValues,
    service,
    values: form.getValues(),
  });

  function resetLifecycle() {
    setStep("form");
    setDateTimeOpen(false);
    setSubmitError(undefined);
    setIdempotencyBinding(undefined);
    setSessionNonce(crypto.randomUUID());
    form.reset();
  }

  function handleDateTimeConfirm({ date, time }: { date: string; time: string }) {
    form.setValue("date", date, { shouldDirty: true, shouldValidate: true });
    form.setValue("time", time, { shouldDirty: true, shouldValidate: true });
    setDateTimeOpen(false);
  }

  async function handleSubmit(values: MeetingFormValues) {
    const fingerprint = createIdempotencyFingerprint({ origin, previousValues, service, sessionNonce, values });
    const key = idempotencyBinding?.fingerprint === fingerprint
      ? idempotencyBinding.key
      : crypto.randomUUID();

    setIdempotencyBinding({ fingerprint, key });
    setSubmitError(undefined);
    setStep("loading");

    try {
      const response = await fetch("/api/meeting", {
        body: JSON.stringify(buildMeetingPayload({
          idempotencyKey: key,
          language,
          origin,
          previousValues,
          service,
          values,
        })),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const code = (data as MeetingApiError).error;
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
    resetLifecycle();
    onClose();
  }

  function handleSuccessClose() {
    resetLifecycle();
    if (onComplete) {
      onComplete();
    } else {
      onClose();
    }
  }

  function handleDismiss() {
    if (step === "success") {
      handleSuccessClose();
    } else {
      handleClose();
    }
  }

  return {
    dateTimeOpen,
    form,
    handleBackToForm,
    handleClose,
    handleDateTimeConfirm,
    handleDismiss,
    handleRetry,
    handleSubmit,
    handleSuccessClose,
    isContactOrigin,
    selectedDate,
    selectedTime,
    setDateTimeOpen,
    step,
    submitError,
    whatsAppMessage,
    whatsAppUrl: createWhatsAppUrl(whatsAppMessage),
  };
}
