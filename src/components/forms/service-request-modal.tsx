"use client";

import { useState } from "react";
import Image from "next/image";
import type { Dictionary, Language, LocalizedString } from "@/lib/i18n";
import type { Service } from "@/data/content";
import { Modal } from "@/components/ui";
import type { ServiceFormId } from "./schemas";
import { ServiceFormAudit } from "./service-form-audit";
import { ServiceFormAutomation } from "./service-form-automation";
import { ServiceFormCustom } from "./service-form-custom";
import { ServiceFormEcommerce } from "./service-form-ecommerce";
import { ServiceFormLanding } from "./service-form-landing";
import { MeetingModal } from "./meeting-modal";
import { createWhatsAppMessage, createWhatsAppUrl, type ServiceRequestValues } from "./whatsapp-link";

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
  service,
  values,
}: {
  dictionary: Dictionary;
  language: Language;
  service: ServiceRequestTarget;
  values: ServiceRequestValues;
}) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const whatsAppMessage = createWhatsAppMessage({
    emptyMessageFallback: dictionary.forms.success.emptyMessageFallback,
    language,
    serviceId: service.id,
    serviceName: service.title[language],
    values,
  });
  const whatsAppUrl = createWhatsAppUrl(whatsAppMessage);

  return (
    <div className="space-y-4">
      <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{service.title[language]}</p>
      <h3 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">{dictionary.forms.success.title}</h3>
      <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{dictionary.forms.success.message}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="group inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
          onClick={() => setMeetingOpen(true)}
          type="button"
        >
          {dictionary.meeting.contact.cta}
          <Image
            alt=""
            aria-hidden="true"
            className="size-4 transition group-hover:invert dark:invert dark:group-hover:invert-0"
            height={16}
            src="/handwritten-icons/calendar.svg"
            width={16}
          />
        </button>
        <a
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
          href={whatsAppUrl}
          rel="noreferrer"
          target="_blank"
        >
          {dictionary.forms.success.whatsApp}
        </a>
      </div>
      <MeetingModal
        closeLabel={dictionary.modals.closeLabel}
        dictionary={dictionary}
        isOpen={meetingOpen}
        language={language}
        onClose={() => setMeetingOpen(false)}
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

  if (!isOpen || !service) {
    return null;
  }

  const currentService = service;
  const formId = `service-form-${currentService.id}`;
  const submittedValues = submittedRequest?.serviceId === currentService.id ? submittedRequest.values : null;

  function handleSubmit(values: ServiceRequestValues) {
    setSubmittedRequest({
      serviceId: currentService.id,
      values,
    });
  }

  const modalFooter = submittedValues ? null : (
    <div className="flex justify-center sm:justify-start">
      <button
        className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
        form={formId}
        type="submit"
      >
        {dictionary.forms.common.submit}
      </button>
    </div>
  );

  return (
    <Modal closeLabel={closeLabel} footer={modalFooter} isOpen={isOpen} onClose={onClose} size="lg" title={currentService.title[language]}>
      {submittedValues ? (
        <SuccessState dictionary={dictionary} language={language} service={currentService} values={submittedValues} />
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{currentService.description[language]}</p>
            <p className="text-base text-muted-foreground md:text-sm">{dictionary.forms.common.requiredFieldsMessage}</p>
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
