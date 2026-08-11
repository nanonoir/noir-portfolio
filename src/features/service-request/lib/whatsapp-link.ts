import { contactLinks } from "@/data/content";
import type { Dictionary, Language } from "@/lib/i18n";
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

function labels(language: Language) {
  return language === "es"
    ? {
        automationType: "Tipo de automatización", brandName: "Marca / empresa", budget: "Presupuesto", business: "Empresa / negocio", email: "Correo", intro: "Hola Nahuel, te envié una solicitud por", message: "Mensaje", name: "Nombre", phone: "WhatsApp", projectType: "Tipo de proyecto", social: "Red social", website: "Web",
      }
    : {
        automationType: "Automation type", brandName: "Brand / company", budget: "Budget", business: "Company / business", email: "Email", intro: "Hi Nahuel, I sent you a request for", message: "Message", name: "Name", phone: "WhatsApp", projectType: "Project type", social: "Social profile", website: "Website",
      };
}

function projectTypeLabel(value: LandingFormValues["projectType"], language: Language) {
  if (value === "business") return language === "es" ? "Marca / empresa" : "Brand / company";
  return language === "es" ? "Personal" : "Personal";
}

function automationTypeLabel(value: AutomationFormValues["automationType"], language: Language) {
  const automationLabels = {
    "customer-service": { es: "Atención al cliente", en: "Customer service" },
    "business-processes": { es: "Procesos del negocio", en: "Business processes" },
    other: { es: "Otro", en: "Other" },
  } as const;

  return automationLabels[value][language];
}

function serviceSpecificLines({ language, optionalFallback, serviceId, values }: {
  language: Language;
  optionalFallback: string;
  serviceId: ServiceFormId;
  values: ServiceRequestValues;
}) {
  const fieldLabels = labels(language);

  switch (serviceId) {
    case "web-audit":
      return [`${fieldLabels.website}: ${(values as AuditFormValues).websiteUrl}`];
    case "landing": {
      const data = values as LandingFormValues;
      return [
        `${fieldLabels.projectType}: ${projectTypeLabel(data.projectType, language)}`,
        `${fieldLabels.brandName}: ${valueOrFallback(data.brandName, optionalFallback)}`,
        `${fieldLabels.social}: ${valueOrFallback(data.social, optionalFallback)}`,
      ];
    }
    case "ecommerce": {
      const data = values as EcommerceFormValues;
      return [
        `${fieldLabels.brandName}: ${data.brandName}`,
        `${fieldLabels.social}: ${valueOrFallback(data.social, optionalFallback)}`,
      ];
    }
    case "automation": {
      const data = values as AutomationFormValues;
      return [
        `${fieldLabels.brandName}: ${data.brandName}`,
        `${fieldLabels.automationType}: ${automationTypeLabel(data.automationType, language)}`,
      ];
    }
    case "custom": {
      const data = values as CustomServiceFormValues;
      return [
        `${fieldLabels.business}: ${valueOrFallback(data.business, optionalFallback)}`,
        `${fieldLabels.social}: ${valueOrFallback(data.social, optionalFallback)}`,
        `${fieldLabels.budget}: ${valueOrFallback(data.budget, optionalFallback)}`,
      ];
    }
  }
}

export function createWhatsAppMessage({ fallbacks, language, serviceId, serviceName, values }: {
  fallbacks: Dictionary["forms"]["success"]["fallbacks"];
  language: Language;
  serviceId: ServiceFormId;
  serviceName: string;
  values: ServiceRequestValues;
}) {
  const fieldLabels = labels(language);

  return [
    `${fieldLabels.intro} ${serviceName}.`,
    "",
    `${fieldLabels.name}: ${valueOrFallback(values.name, fallbacks.name)}`,
    `${fieldLabels.email}: ${valueOrFallback(values.email, fallbacks.email)}`,
    `${fieldLabels.phone}: ${valueOrFallback(values.phone, fallbacks.phone)}`,
    "",
    ...serviceSpecificLines({ language, optionalFallback: fallbacks.optional, serviceId, values }),
    "",
    `${fieldLabels.message}: ${valueOrFallback(values.message, fallbacks.message)}`,
  ].join("\n");
}

export function createWhatsAppUrl(message: string) {
  return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
}
