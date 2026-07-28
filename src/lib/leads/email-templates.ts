import "server-only";

import type { LeadRecord } from "./lead-model";

type Locale = LeadRecord["locale"];

const NOT_PROVIDED = {
  en: "Not provided",
  es: "No proporcionado",
} as const;

const LABELS = {
  en: {
    automationType: "Automation type",
    brandName: "Brand / company",
    budget: "Budget",
    business: "Business",
    email: "Email",
    message: "Message",
    name: "Name",
    phone: "Phone",
    projectType: "Project type",
    service: "Service",
    social: "Social profile",
    submittedAt: "Submitted at",
    websiteUrl: "Website URL",
  },
  es: {
    automationType: "Tipo de automatización",
    brandName: "Marca / empresa",
    budget: "Presupuesto",
    business: "Empresa / negocio",
    email: "Correo",
    message: "Mensaje",
    name: "Nombre",
    phone: "Teléfono",
    projectType: "Tipo de proyecto",
    service: "Servicio",
    social: "Red social",
    submittedAt: "Enviado el",
    websiteUrl: "Enlace de la web",
  },
} as const;

const SUBJECTS = {
  contact_message: {
    en: "New contact message",
    es: "Nuevo mensaje de contacto",
  },
  custom_service_request: {
    en: "New custom service request",
    es: "Nueva solicitud de servicio personalizado",
  },
  service_request: {
    en: "New service request",
    es: "Nueva solicitud de servicio",
  },
} as const;

export interface ComposedLeadEmail {
  html: string;
  subject: string;
  text: string;
}

type LeadField = keyof (typeof LABELS)["en"];
const SERVICE_TITLES: Record<string, Record<Locale, string>> = {
  "web-audit": { en: "Web Audit", es: "Auditoría Web" },
  landing: { en: "Landing / Business Website", es: "Landing / Web Institucional" },
  ecommerce: { en: "E-commerce Store", es: "Tienda E-commerce" },
  automation: { en: "Automations", es: "Automatizaciones" },
  custom_software: { en: "Custom software", es: "Software a medida" },
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

export function composeLeadEmail(lead: LeadRecord): ComposedLeadEmail {
  const locale = lead.locale;
  const fields = fieldsFor(lead).map(([field, value]) => [field, field === "service" && value ? SERVICE_TITLES[value]?.[lead.locale] ?? value : value] as [LeadField, string | undefined]);
  const detailsHtml = fields
    .map(([field, value]) => `<tr><td style="padding:8px 0;color:#737373;font-family:Arial,sans-serif;font-size:14px;vertical-align:top;width:150px">${escapeHtml(LABELS[locale][field])}</td><td style="padding:8px 0;color:#171717;font-family:Arial,sans-serif;font-size:14px;vertical-align:top">${escapeHtml(displayValue(value, locale))}</td></tr>`)
    .join("");
  const detailsText = fields
    .map(([field, value]) => `${LABELS[locale][field]}: ${displayValue(value, locale)}`)
    .join("\n");

  return {
    subject: SUBJECTS[lead.type][locale],
    html: `<!doctype html><html lang="${locale}"><body style="margin:0;padding:0;background:#f5f5f5"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e5e5"><tr><td style="background:#171717;padding:22px 32px;color:#fff;font-family:Arial,sans-serif;font-weight:700;letter-spacing:2px">NOIR</td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 20px;color:#171717;font-family:Arial,sans-serif;font-size:24px">${escapeHtml(SUBJECTS[lead.type][locale])}</h1><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml}</table></td></tr></table></td></tr></table></body></html>`,
    text: `${SUBJECTS[lead.type][locale]}\n\n${detailsText}`,
  };
}

function fieldsFor(lead: LeadRecord): Array<[LeadField, string | undefined]> {
  const common: Array<[LeadField, string | undefined]> = [["email", lead.email]];
  if (lead.type === "contact_message") {
    return [...common, ["message", lead.message], ["submittedAt", lead.submittedAt]];
  }

  return [
    ["name", lead.name],
    ...common,
    ["phone", lead.phone],
    ["service", lead.service],
    ["websiteUrl", lead.websiteUrl],
    ["projectType", lead.projectType],
    ["brandName", lead.brandName],
    ["social", lead.social],
    ["automationType", lead.automationType],
    ["business", lead.business],
    ["budget", lead.budget],
    ["message", lead.message],
    ["submittedAt", lead.submittedAt],
  ];
}

function displayValue(value: string | undefined, locale: Locale): string {
  return value?.trim() || NOT_PROVIDED[locale];
}
