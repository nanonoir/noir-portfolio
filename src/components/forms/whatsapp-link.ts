import { contactLinks } from "@/data/content";
import type { Language } from "@/lib/i18n";
import type {
  AuditFormValues,
  AutomationFormValues,
  CustomServiceFormValues,
  EcommerceFormValues,
  LandingFormValues,
  ServiceFormId,
} from "./schemas";

export type ServiceRequestValues =
  | AuditFormValues
  | LandingFormValues
  | EcommerceFormValues
  | AutomationFormValues
  | CustomServiceFormValues;

const WHATSAPP_PHONE = contactLinks.whatsApp.match(/phone=(\d+)/)?.[1] ?? "543794657335";

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function projectTypeLabel(value: LandingFormValues["projectType"], language: Language) {
  if (value === "business") {
    return language === "es" ? "Marca / empresa" : "Brand / company";
  }

  return language === "es" ? "Personal" : "Personal";
}

function automationTypeLabel(value: AutomationFormValues["automationType"], language: Language) {
  const labels = {
    "customer-service": { es: "Atención al cliente", en: "Customer service" },
    "business-processes": { es: "Procesos del negocio", en: "Business processes" },
    other: { es: "Otro", en: "Other" },
  } as const;

  return labels[value][language];
}

function serviceSpecificLines({
  fallback,
  language,
  serviceId,
  values,
}: {
  fallback: string;
  language: Language;
  serviceId: ServiceFormId;
  values: ServiceRequestValues;
}) {
  switch (serviceId) {
    case "web-audit": {
      const data = values as AuditFormValues;
      return [`Web: ${data.websiteUrl}`];
    }
    case "landing": {
      const data = values as LandingFormValues;
      return [
        `Tipo de proyecto: ${projectTypeLabel(data.projectType, language)}`,
        `Marca / empresa: ${valueOrFallback(data.brandName, fallback)}`,
        `Red social: ${valueOrFallback(data.social, fallback)}`,
      ];
    }
    case "ecommerce": {
      const data = values as EcommerceFormValues;
      return [
        `Marca / empresa: ${data.brandName}`,
        `Red social: ${valueOrFallback(data.social, fallback)}`,
      ];
    }
    case "automation": {
      const data = values as AutomationFormValues;
      return [
        `Marca / empresa: ${data.brandName}`,
        `Tipo de automatización: ${automationTypeLabel(data.automationType, language)}`,
      ];
    }
    case "custom": {
      const data = values as CustomServiceFormValues;
      return [
        `Empresa / negocio: ${valueOrFallback(data.business, fallback)}`,
        `Redes sociales: ${valueOrFallback(data.social, fallback)}`,
        `Presupuesto: ${valueOrFallback(data.budget, fallback)}`,
      ];
    }
  }
}

export function createWhatsAppMessage({
  emptyMessageFallback,
  language,
  serviceId,
  serviceName,
  values,
}: {
  emptyMessageFallback: string;
  language: Language;
  serviceId: ServiceFormId;
  serviceName: string;
  values: ServiceRequestValues;
}) {
  return [
    `Hola Nahuel, te envié una solicitud por ${serviceName}.`,
    "",
    `Nombre: ${values.name}`,
    `Correo: ${values.email}`,
    `WhatsApp: ${values.phone}`,
    "",
    ...serviceSpecificLines({ fallback: emptyMessageFallback, language, serviceId, values }),
    "",
    `Mensaje: ${valueOrFallback(values.message, emptyMessageFallback)}`,
  ].join("\n");
}

export function createWhatsAppUrl(message: string) {
  return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
}
