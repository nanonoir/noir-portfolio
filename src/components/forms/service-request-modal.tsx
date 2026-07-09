"use client";

import type { Dictionary, Language, LocalizedString } from "@/lib/i18n";
import type { Service } from "@/data/content";
import { Modal } from "@/components/ui";
import type {
  AuditFormValues,
  AutomationFormValues,
  CustomServiceFormValues,
  EcommerceFormValues,
  LandingFormValues,
  ServiceFormId,
} from "./schemas";
import { ServiceFormAudit } from "./service-form-audit";
import { ServiceFormAutomation } from "./service-form-automation";
import { ServiceFormCustom } from "./service-form-custom";
import { ServiceFormEcommerce } from "./service-form-ecommerce";
import { ServiceFormLanding } from "./service-form-landing";

export type ServiceRequestTarget = Pick<Service, "description" | "features" | "title"> & {
  id: ServiceFormId;
};

type ServiceRequestValues =
  | AuditFormValues
  | LandingFormValues
  | EcommerceFormValues
  | AutomationFormValues
  | CustomServiceFormValues;

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

export function ServiceRequestModal({
  closeLabel,
  dictionary,
  isOpen,
  language,
  onClose,
  service,
}: ServiceRequestModalProps) {
  if (!service) {
    return null;
  }

  function handleSubmit(values: ServiceRequestValues) {
    console.log("Service request submitted", {
      service: service?.id,
      values,
    });
  }

  return (
    <Modal closeLabel={closeLabel} isOpen={isOpen} onClose={onClose} size="lg" title={service.title[language]}>
      <div className="mb-6 space-y-2">
        <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{service.description[language]}</p>
        <p className="text-base text-muted-foreground md:text-sm">{dictionary.forms.common.requiredFieldsMessage}</p>
      </div>
      <ServiceRequestForm dictionary={dictionary} onSubmit={handleSubmit} serviceId={service.id} />
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
