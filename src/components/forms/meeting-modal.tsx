"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, FormError, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import { MeetingCalendar, type AvailabilityState } from "./meeting-calendar";
import { MeetingError } from "./meeting-error";
import { MeetingSlots } from "./meeting-slots";
import { MeetingSuccess } from "./meeting-success";
import { createWhatsAppUrl, type ServiceRequestValues } from "./whatsapp-link";
import {
  meetingFromContactSchema,
  meetingFromServiceSchema,
  type AutomationFormValues,
  type AuditFormValues,
  type CustomServiceFormValues,
  type EcommerceFormValues,
  type LandingFormValues,
  type MeetingFromContactValues,
  type MeetingFromServiceValues,
} from "./schemas";
import { scrollToFirstError } from "./service-form-fields";
import type { ServiceRequestTarget } from "./service-request-modal";

type MeetingStep = "form" | "loading" | "success" | "error";

type MeetingModalProps = {
  closeLabel?: string;
  dictionary: Dictionary;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  origin?: "contact" | "service" | "custom";
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
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

type ServiceMeetingPayload = {
  type: "meeting_request";
  origin: "Solicitud de servicio";
  relatedService: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  message?: string;
  meeting: {
    date: string;
    time: string;
  };
  previousRequest: {
    service: string;
    details: Record<string, unknown>;
  };
};

type CustomSoftwareMeetingPayload = {
  type: "meeting_request";
  origin: "Software a medida";
  relatedService: "Software a medida";
  name: string;
  email: string;
  phone: string;
  company?: string;
  message?: string;
  meeting: {
    date: string;
    time: string;
  };
  previousRequest: {
    reason: "Software a medida";
    details: {
      projectIdea?: string;
      currentProblem?: string;
      priority?: string;
      budget?: string;
    };
  };
};

type MeetingPayload = ContactMeetingPayload | ServiceMeetingPayload | CustomSoftwareMeetingPayload;

type MeetingFormValues = MeetingFromServiceValues & Partial<Omit<MeetingFromContactValues, keyof MeetingFromServiceValues>>;

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) return undefined;

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

function createMeetingWhatsAppMessage(values: Partial<MeetingFormValues>, dictionary: Dictionary) {
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

function trimmedOptional(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
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

function getServiceCompany(service: ServiceRequestTarget | null | undefined, values: ServiceRequestValues) {
  if (service?.id === "landing" || service?.id === "ecommerce" || service?.id === "automation") {
    return trimmedOptional((values as LandingFormValues | EcommerceFormValues | AutomationFormValues).brandName);
  }

  if (service?.id === "custom") {
    return trimmedOptional((values as CustomServiceFormValues).business);
  }

  return undefined;
}

function getServiceDetails(service: ServiceRequestTarget, values: ServiceRequestValues): Record<string, unknown> {
  switch (service.id) {
    case "web-audit": {
      const data = values as AuditFormValues;
      return { websiteUrl: data.websiteUrl };
    }
    case "landing": {
      const data = values as LandingFormValues;
      return {
        projectType: data.projectType,
        brandName: trimmedOptional(data.brandName),
        social: trimmedOptional(data.social),
      };
    }
    case "ecommerce": {
      const data = values as EcommerceFormValues;
      return {
        brandName: data.brandName,
        social: trimmedOptional(data.social),
      };
    }
    case "automation": {
      const data = values as AutomationFormValues;
      return {
        brandName: data.brandName,
        automationType: data.automationType,
      };
    }
    case "custom": {
      const data = values as CustomServiceFormValues;
      return {
        business: trimmedOptional(data.business),
        social: trimmedOptional(data.social),
        budget: trimmedOptional(data.budget),
      };
    }
  }
}

function buildServiceMeetingPayload({
  language,
  service,
  schedule,
  values,
}: {
  language: Language;
  service: ServiceRequestTarget;
  schedule: MeetingFromServiceValues;
  values: ServiceRequestValues;
}): ServiceMeetingPayload {
  const message = trimmedOptional(schedule.message) || trimmedOptional(values.message);
  const company = getServiceCompany(service, values);
  const serviceName = service.title[language];

  return {
    type: "meeting_request",
    origin: "Solicitud de servicio",
    relatedService: serviceName,
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    ...(company ? { company } : {}),
    ...(message ? { message } : {}),
    meeting: {
      date: schedule.date,
      time: schedule.time,
    },
    previousRequest: {
      service: serviceName,
      details: getServiceDetails(service, values),
    },
  };
}

function buildCustomSoftwareMeetingPayload(schedule: MeetingFromServiceValues, values: ServiceRequestValues): CustomSoftwareMeetingPayload {
  const data = values as CustomServiceFormValues;
  const message = trimmedOptional(schedule.message) || trimmedOptional(data.message);
  const company = trimmedOptional(data.business);

  return {
    type: "meeting_request",
    origin: "Software a medida",
    relatedService: "Software a medida",
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    ...(company ? { company } : {}),
    ...(message ? { message } : {}),
    meeting: {
      date: schedule.date,
      time: schedule.time,
    },
    previousRequest: {
      reason: "Software a medida",
      details: {
        projectIdea: trimmedOptional(data.message),
        currentProblem: company,
        priority: trimmedOptional(data.social),
        budget: trimmedOptional(data.budget),
      },
    },
  };
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
  origin = "contact",
  previousValues,
  service,
}: MeetingModalProps) {
  const isContactOrigin = origin === "contact";
  const [step, setStep] = useState<MeetingStep>("form");
  const [availability, setAvailability] = useState<AvailabilityState>(INITIAL_AVAILABILITY);
  const [submitError, setSubmitError] = useState<string>();
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

  function buildPayload(values: MeetingFormValues): MeetingPayload {
    if (isContactOrigin) {
      return buildContactMeetingPayload(values as MeetingFromContactValues);
    }

    if (!service || !previousValues) {
      throw new Error(dictionary.meeting.error.message);
    }

    const schedule = {
      date: values.date,
      message: values.message,
      time: values.time,
    } satisfies MeetingFromServiceValues;

    if (origin === "custom") {
      return buildCustomSoftwareMeetingPayload(schedule, previousValues);
    }

    return buildServiceMeetingPayload({ language, schedule, service, values: previousValues });
  }

  async function handleSubmit(values: MeetingFormValues) {
    setSubmitError(undefined);
    setStep("loading");

    try {
      const response = await fetch("/api/meeting", {
        body: JSON.stringify(buildPayload(values)),
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

  const formId = isContactOrigin ? "meeting-contact-form" : "meeting-service-form";
  const footer = step === "form" ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      <Button variant="outlined" onClick={handleClose}>{dictionary.meeting.actions.close}</Button>
      <Button disabled={availability.status === "loading"} form={formId} type="submit">
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
          id={formId}
          noValidate
          onSubmit={form.handleSubmit(handleSubmit, scrollToFirstError)}
        >
          <div className="space-y-2">
            <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
              {isContactOrigin ? dictionary.meeting.descriptionFromContact : dictionary.meeting.descriptionFromService}
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
            {isContactOrigin ? (
              <>
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
              </>
            ) : null}

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
