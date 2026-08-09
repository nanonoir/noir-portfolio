"use client";

import { useState } from "react";
import type { Dictionary, Language, LocalizedString } from "@/lib/i18n";
import type { Service } from "@/data/content";
import { ActionLink, Button, HandwrittenIcon, Modal } from "@/components/ui";
import type { ServiceFormId } from "../lib/schemas";
import { ServiceFormAudit } from "./service-form-audit";
import { ServiceFormAutomation } from "./service-form-automation";
import { ServiceFormCustom } from "./service-form-custom";
import { ServiceFormEcommerce } from "./service-form-ecommerce";
import { ServiceFormLanding } from "./service-form-landing";
import { MeetingModal } from "@/features/meeting/components/meeting-modal";
import { createWhatsAppMessage, createWhatsAppUrl, type ServiceRequestValues } from "../lib/whatsapp-link";

export type ServiceRequestTarget = Pick<Service, "description" | "features" | "title"> & {
  id: ServiceFormId;
};

type ServiceRequestModalProps = {
  closeLabel: string;
  dictionary: Dictionary;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  service: ServiceRequestTarget | null;
};

function ServiceRequestForm({
  dictionary,
  formId,
  onSubmit,
  serviceId,
}: {
  dictionary: Dictionary;
  formId: string;
  onSubmit: (values: ServiceRequestValues) => void;
  serviceId: ServiceFormId;
}) {
  switch (serviceId) {
    case "web-audit":
      return <ServiceFormAudit dictionary={dictionary} formId={formId} onSubmit={onSubmit} />;
    case "landing":
      return <ServiceFormLanding dictionary={dictionary} formId={formId} onSubmit={onSubmit} />;
    case "ecommerce":
      return <ServiceFormEcommerce dictionary={dictionary} formId={formId} onSubmit={onSubmit} />;
    case "automation":
      return <ServiceFormAutomation dictionary={dictionary} formId={formId} onSubmit={onSubmit} />;
    case "custom":
      return <ServiceFormCustom dictionary={dictionary} formId={formId} onSubmit={onSubmit} />;
  }
}

function SuccessState({
  dictionary,
  language,
  onParentClose,
  service,
  values,
}: {
  dictionary: Dictionary;
  language: Language;
  onParentClose: () => void;
  service: ServiceRequestTarget;
  values: ServiceRequestValues;
}) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const whatsAppMessage = createWhatsAppMessage({
    fallbacks: dictionary.forms.success.fallbacks,
    language,
    serviceId: service.id,
    serviceName: service.title[language],
    values,
  });
  const whatsAppUrl = createWhatsAppUrl(whatsAppMessage);

  return (
    <div className="space-y-4">
      <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{service.title[language]}</p>
      <div className="flex items-center gap-3">
        <HandwrittenIcon className="size-6 shrink-0 text-success" icon="check" />
        <h3 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">{dictionary.forms.success.title}</h3>
      </div>
      <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{dictionary.forms.success.message}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          icon={
            <HandwrittenIcon className="size-4" icon="calendar" />
          }
          label={dictionary.meeting.contact.cta}
          onClick={() => setMeetingOpen(true)}
          type="button"
          variant="outlined"
        />
        <ActionLink
          href={whatsAppUrl}
          label={dictionary.forms.success.whatsApp}
          rel="noreferrer"
          size="lg"
          target="_blank"
        />
      </div>
      <MeetingModal
        closeLabel={dictionary.modals.closeLabel}
        dictionary={dictionary}
        isOpen={meetingOpen}
        language={language}
        onClose={() => setMeetingOpen(false)}
        onComplete={() => {
          // Meeting completed successfully: close child, then close parent
          setMeetingOpen(false);
          onParentClose();
        }}
        origin={service.id === "custom" ? "custom" : "service"}
        previousValues={values}
        service={service}
      />
    </div>
  );
}

export function ServiceRequestModal({
  closeLabel,
  dictionary,
  isOpen,
  language,
  onClose,
  service,
}: ServiceRequestModalProps) {
  const [submittedRequest, setSubmittedRequest] = useState<{
    serviceId: ServiceFormId;
    values: ServiceRequestValues;
  } | null>(null);
  const [submissionError, setSubmissionError] = useState(false);
  const [submissionBinding, setSubmissionBinding] = useState<{ fingerprint: string; key: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !service) {
    return null;
  }

  const currentService = service;
  const formId = `service-form-${currentService.id}`;
  const submittedValues = submittedRequest?.serviceId === currentService.id ? submittedRequest.values : null;

  async function handleSubmit(values: ServiceRequestValues) {
    if (isSubmitting) return;

    const fingerprint = JSON.stringify({ service: currentService.id, values });
    const idempotencyKey = submissionBinding?.fingerprint === fingerprint ? submissionBinding.key : crypto.randomUUID();
    setSubmissionBinding({ fingerprint, key: idempotencyKey });
    setIsSubmitting(true);
    setSubmissionError(false);

    try {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({
          ...values,
          idempotencyKey,
          locale: language,
          service: currentService.id,
          type: currentService.id === "custom" ? "custom_service_request" : "service_request",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof result !== "object" || result === null || (result as { success?: unknown }).success !== true) {
        setSubmissionError(true);
        return;
      }

      setSubmittedRequest({ serviceId: currentService.id, values });
    } catch {
      setSubmissionError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setSubmissionBinding(null);
    setSubmissionError(false);
    setSubmittedRequest(null);
    onClose();
  }

  const modalFooter = submittedValues ? null : (
    <div className="flex justify-center sm:justify-start">
      <Button
        aria-busy={isSubmitting}
        disabled={isSubmitting}
        form={formId}
        label={isSubmitting ? dictionary.forms.common.submitting : dictionary.forms.common.submit}
        type="submit"
      />
    </div>
  );

  return (
    <Modal closeLabel={closeLabel} footer={modalFooter} initialFocus="heading" isOpen={isOpen} onClose={handleClose} size="lg" title={currentService.title[language]}>
      {submittedValues ? (
        <SuccessState dictionary={dictionary} language={language} onParentClose={handleClose} service={currentService} values={submittedValues} />
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{currentService.description[language]}</p>
            <p className="text-base text-muted-foreground md:text-sm">{dictionary.forms.common.requiredFieldsMessage}</p>
             {submissionError ? <p className="status-danger flex items-start gap-2 rounded-2xl px-4 py-3 text-base md:text-sm" role="alert"><HandwrittenIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" icon="networkError" /><span>{dictionary.forms.errors.submission}</span></p> : null}
          </div>
          <ServiceRequestForm dictionary={dictionary} formId={formId} onSubmit={handleSubmit} serviceId={currentService.id} />
        </>
      )}
    </Modal>
  );
}

export function createCustomServiceRequestTarget(title: string, description: string): ServiceRequestTarget {
  const localizedTitle: LocalizedString = { es: title, en: title };
  const localizedDescription: LocalizedString = { es: description, en: description };

  return {
    id: "custom",
    title: localizedTitle,
    description: localizedDescription,
    features: [
      { es: "MVPs y herramientas internas", en: "MVPs and internal tools" },
      { es: "Paneles administrativos", en: "Admin dashboards" },
      { es: "Flujos que no encajan en plantillas", en: "Flows that do not fit templates" },
    ],
  };
}
