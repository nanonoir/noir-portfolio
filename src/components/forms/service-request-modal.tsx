"use client";

import { useEffect, useState } from "react";
import type { Dictionary, Language, LocalizedString } from "@/lib/i18n";
import type { Service } from "@/data/content";
import { Modal } from "@/components/ui";
import type { ServiceFormId } from "./schemas";
import { ServiceFormAudit } from "./service-form-audit";
import { ServiceFormAutomation } from "./service-form-automation";
import { ServiceFormCustom } from "./service-form-custom";
import { ServiceFormEcommerce } from "./service-form-ecommerce";
import { ServiceFormLanding } from "./service-form-landing";
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
  onSubmit,
  serviceId,
}: {
  dictionary: Dictionary;
  onSubmit: (values: ServiceRequestValues) => void;
  serviceId: ServiceFormId;
}) {
  switch (serviceId) {
    case "web-audit":
      return <ServiceFormAudit dictionary={dictionary} onSubmit={onSubmit} />;
    case "landing":
      return <ServiceFormLanding dictionary={dictionary} onSubmit={onSubmit} />;
    case "ecommerce":
      return <ServiceFormEcommerce dictionary={dictionary} onSubmit={onSubmit} />;
    case "automation":
      return <ServiceFormAutomation dictionary={dictionary} onSubmit={onSubmit} />;
    case "custom":
      return <ServiceFormCustom dictionary={dictionary} onSubmit={onSubmit} />;
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
  const whatsAppMessage = createWhatsAppMessage({
    emptyMessageFallback: dictionary.forms.success.emptyMessageFallback,
    language,
    serviceId: service.id,
    serviceName: service.title[language],
    values,
  });
  const whatsAppUrl = createWhatsAppUrl(whatsAppMessage);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{service.title[language]}</p>
        <h3 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">{dictionary.forms.success.title}</h3>
        <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{dictionary.forms.success.message}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <span className="inline-flex" title={dictionary.forms.success.meetingUnavailable}>
          <button
            aria-describedby="meeting-unavailable-tooltip"
            className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-foreground/20 px-5 py-2.5 text-base font-medium text-muted-foreground opacity-60 md:text-sm"
            disabled
            title={dictionary.forms.success.meetingUnavailable}
            type="button"
          >
            {dictionary.forms.success.meeting}
          </button>
        </span>
        <p className="sr-only" id="meeting-unavailable-tooltip">{dictionary.forms.success.meetingUnavailable}</p>
        <a
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
          href={whatsAppUrl}
          rel="noreferrer"
          target="_blank"
        >
          {dictionary.forms.success.whatsApp}
        </a>
      </div>
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
  const [submittedValues, setSubmittedValues] = useState<ServiceRequestValues | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSubmittedValues(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSubmittedValues(null);
  }, [service?.id]);

  if (!service) {
    return null;
  }

  function handleSubmit(values: ServiceRequestValues) {
    console.log("Service request submitted", {
      service: service?.id,
      values,
    });
    setSubmittedValues(values);
  }

  return (
    <Modal closeLabel={closeLabel} isOpen={isOpen} onClose={onClose} size="lg" title={service.title[language]}>
      {submittedValues ? (
        <SuccessState dictionary={dictionary} language={language} service={service} values={submittedValues} />
      ) : (
        <>
          <div className="mb-6 space-y-2">
            <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{service.description[language]}</p>
            <p className="text-base text-muted-foreground md:text-sm">{dictionary.forms.common.requiredFieldsMessage}</p>
          </div>
          <ServiceRequestForm dictionary={dictionary} onSubmit={handleSubmit} serviceId={service.id} />
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
