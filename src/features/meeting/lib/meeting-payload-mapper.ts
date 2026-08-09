import type { Language } from "@/lib/i18n";
import { getVisitorTimeZone } from "./date-time-constants";
import type {
  MeetingFromContactValues,
  MeetingFromServiceValues,
} from "./schemas";
import type {
  AutomationFormValues,
  AuditFormValues,
  CustomServiceFormValues,
  EcommerceFormValues,
  LandingFormValues,
} from "@/features/service-request/lib/schemas";
import type { ServiceRequestTarget } from "@/features/service-request/components/service-request-modal";
import type { ServiceRequestValues } from "@/features/service-request/lib/whatsapp-link";

export type MeetingFormValues = MeetingFromServiceValues & Partial<Omit<MeetingFromContactValues, keyof MeetingFromServiceValues>>;

type MeetingIdentity = { name: string; email: string; phone: string; message?: string };
type ProposalMetadata = { originVersion: "meet-ui-v2"; proposalVersion: "meet-ui-v2"; submittedAt: string };
type MeetingRequestContext = { idempotencyKey: string; locale: string; proposalMetadata: ProposalMetadata; timezone: string };

type ContactMeetingPayload = {
  type: "meeting_request"; origin: "contact"; reason: "project" | "job" | "general"; identity: MeetingIdentity;
  locale: string; idempotencyKey: string; proposalMetadata: ProposalMetadata; meeting: { date: string; time: string; timezone: string };
};
type ServiceMeetingPayload = {
  type: "meeting_request"; origin: "service"; relatedService: string; identity: MeetingIdentity;
  locale: string; idempotencyKey: string; proposalMetadata: ProposalMetadata; meeting: { date: string; time: string; timezone: string };
  previousRequest: { service: string; details: Record<string, unknown> };
};
type CustomSoftwareMeetingPayload = {
  type: "meeting_request"; origin: "custom_software"; relatedService: "custom_software"; identity: MeetingIdentity;
  locale: string; idempotencyKey: string; proposalMetadata: ProposalMetadata; meeting: { date: string; time: string; timezone: string };
  previousRequest: { service: "custom_software"; details: { projectIdea?: string; currentProblem?: string; priority?: string; budget?: string } };
};
export type MeetingPayload = ContactMeetingPayload | ServiceMeetingPayload | CustomSoftwareMeetingPayload;

export interface BuildMeetingPayloadInput {
  idempotencyKey: string;
  language: Language;
  origin: "contact" | "service" | "custom";
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
  values: MeetingFormValues;
}

function trimmedOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getVisitorLocale(language: Language) {
  return navigator.language || (language === "es" ? "es-AR" : "en-US");
}

function getServiceDetails(service: ServiceRequestTarget, values: ServiceRequestValues): Record<string, unknown> {
  switch (service.id) {
    case "web-audit": return { websiteUrl: (values as AuditFormValues).websiteUrl };
    case "landing": {
      const data = values as LandingFormValues;
      return { projectType: data.projectType, brandName: trimmedOptional(data.brandName), social: trimmedOptional(data.social) };
    }
    case "ecommerce": {
      const data = values as EcommerceFormValues;
      return { brandName: data.brandName, social: trimmedOptional(data.social) };
    }
    case "automation": {
      const data = values as AutomationFormValues;
      return { brandName: data.brandName, automationType: data.automationType };
    }
    case "custom": {
      const data = values as CustomServiceFormValues;
      return { business: trimmedOptional(data.business), social: trimmedOptional(data.social), budget: trimmedOptional(data.budget) };
    }
  }
}

function createContext(idempotencyKey: string, language: Language): MeetingRequestContext {
  return {
    idempotencyKey,
    locale: getVisitorLocale(language),
    proposalMetadata: { originVersion: "meet-ui-v2", proposalVersion: "meet-ui-v2", submittedAt: new Date().toISOString() },
    timezone: getVisitorTimeZone(),
  };
}

export function buildMeetingPayload({ idempotencyKey, language, origin, previousValues, service, values }: BuildMeetingPayloadInput): MeetingPayload {
  const context = createContext(idempotencyKey, language);

  if (origin === "contact") {
    const contact = values as MeetingFromContactValues;
    const message = trimmedOptional(contact.message);
    return {
      type: "meeting_request", origin: "contact", reason: contact.reason,
      identity: { name: contact.name.trim(), email: contact.email.trim().toLowerCase(), phone: contact.phone.trim(), ...(message ? { message } : {}) },
      ...context, meeting: { date: contact.date, time: contact.time, timezone: context.timezone },
    };
  }

  if (!service || !previousValues) throw new Error("Meeting request context is missing");

  const schedule = values as MeetingFromServiceValues;
  const message = trimmedOptional(schedule.message) || trimmedOptional(previousValues.message);

  if (origin === "custom") {
    const data = previousValues as CustomServiceFormValues;
    const company = trimmedOptional(data.business);
    return {
      type: "meeting_request", origin: "custom_software", relatedService: "custom_software",
      identity: { name: data.name.trim(), email: data.email.trim().toLowerCase(), phone: data.phone.trim(), ...(message ? { message } : {}) },
      ...context, meeting: { date: schedule.date, time: schedule.time, timezone: context.timezone },
      previousRequest: { service: "custom_software", details: { projectIdea: trimmedOptional(data.message), currentProblem: company, priority: trimmedOptional(data.social), budget: trimmedOptional(data.budget) } },
    };
  }

  return {
    type: "meeting_request", origin: "service", relatedService: service.id,
    identity: { name: previousValues.name.trim(), email: previousValues.email.trim().toLowerCase(), phone: previousValues.phone.trim(), ...(message ? { message } : {}) },
    ...context, meeting: { date: schedule.date, time: schedule.time, timezone: context.timezone },
    previousRequest: { service: service.id, details: getServiceDetails(service, previousValues) },
  };
}
