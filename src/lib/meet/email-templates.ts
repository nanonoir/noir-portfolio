import "server-only";

import type { BookingRecord } from "./booking-model";
import type { EmailTemplateCode } from "./email-provider";

export interface EmailActionLink { label: string; url: string; }
export interface ComposeMeetingEmailInput {
  template: EmailTemplateCode;
  booking: BookingRecord;
  actionLinks?: readonly EmailActionLink[];
  audience?: "owner" | "visitor";
  note?: string;
}
export interface ComposedMeetingEmail { subject: string; html: string; text: string; }

type Copy = {
  actions: string; brand: string; cancelled: string; confirmed: string; declined: string;
  expired: string; footer: string; meeting: string; proposal: string; received: string;
  requested: string; visitorDetails: string; name: string; email: string; phone: string; reason: string;
  message: string; unavailable: string; timezone: string; date: string; time: string;
};

const COPY: Record<"en" | "es", Copy> = {
  en: {
    actions: "Actions", brand: "NOIR", cancelled: "Meeting cancelled", confirmed: "Your meeting is confirmed",
    declined: "Meeting request update", expired: "Meeting proposal expired", footer: "Nahuel Noir Portfolio",
    meeting: "Meeting details", proposal: "A new meeting time was proposed", received: "We received your meeting request",
    requested: "New meeting request", visitorDetails: "Visitor details", name: "Name", email: "Email", phone: "Phone",
    reason: "Reason", message: "Message", unavailable: "Not provided", timezone: "Timezone", date: "Date", time: "Time",
  },
  es: {
    actions: "Acciones", brand: "NOIR", cancelled: "Reunión cancelada", confirmed: "Tu reunión está confirmada",
    declined: "Actualización de solicitud de reunión", expired: "La propuesta de reunión venció", footer: "Nahuel Noir Portfolio",
    meeting: "Detalles de la reunión", proposal: "Se propuso un nuevo horario", received: "Recibimos tu solicitud de reunión",
    requested: "Nueva solicitud de reunión", visitorDetails: "Datos del visitante", name: "Nombre", email: "Correo", phone: "Teléfono",
    reason: "Motivo", message: "Mensaje", unavailable: "No proporcionado", timezone: "Zona horaria", date: "Fecha", time: "Hora",
  },
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function localeFor(booking: BookingRecord): "en" | "es" { return booking.locale.toLowerCase().startsWith("es") ? "es" : "en"; }
function valueOr(value: string | null | undefined, fallback: string) { return value?.trim() || fallback; }
const SERVICE_TITLES: Record<string, Record<"en" | "es", string>> = {
  "web-audit": { en: "Web Audit", es: "Auditoría Web" },
  landing: { en: "Landing / Business Website", es: "Landing / Web Institucional" },
  ecommerce: { en: "E-commerce Store", es: "Tienda E-commerce" },
  automation: { en: "Automations", es: "Automatizaciones" },
  custom_software: { en: "Custom software", es: "Software a medida" },
};
function resolveReasonLabel(booking: BookingRecord, locale: "en" | "es"): string | null {
  if (booking.reason) return booking.reason;
  const service = booking.relatedService ?? booking.previousRequest?.service;
  return service ? SERVICE_TITLES[service]?.[locale] ?? service : null;
}
function meetingValues(booking: BookingRecord) {
  const slot = booking.proposedSlot;
  return { date: slot?.date ?? booking.meeting.date, time: slot?.time ?? booking.meeting.time, timezone: slot?.visitorTimezone ?? booking.visitorTimezone };
}
function subjectAndIntro(template: EmailTemplateCode, copy: Copy, booking: BookingRecord, locale: "en" | "es"): { subject: string; intro: string } {
  const details = meetingValues(booking);
  const when = `${details.date} ${details.time} (${details.timezone})`;
  switch (template) {
    case "MEETING_REQUESTED": return { subject: copy.requested, intro: locale === "es" ? `${booking.identity.name} solicitó una reunión para ${when}.` : `${booking.identity.name} requested a meeting for ${when}.` };
    case "MEETING_RECEIVED": return { subject: copy.received, intro: locale === "es" ? `Gracias, ${booking.identity.name}. Tu solicitud está pendiente de confirmación.` : `Thank you, ${booking.identity.name}. Your request is pending confirmation.` };
    case "RESCHEDULE_PROPOSED": return { subject: copy.proposal, intro: locale === "es" ? `Se propuso un nuevo horario para ${when}.` : `A new time was proposed for ${when}.` };
    case "MEETING_CONFIRMED": return { subject: copy.confirmed, intro: locale === "es" ? `Tu reunión está programada para ${when}.` : `Your meeting is scheduled for ${when}.` };
    case "MEETING_DECLINED": return { subject: copy.declined, intro: locale === "es" ? "Esta solicitud de reunión fue rechazada." : "This meeting request was declined." };
    case "MEETING_CANCELLED": return { subject: copy.cancelled, intro: locale === "es" ? "Esta reunión fue cancelada." : "This meeting was cancelled." };
    case "MEETING_EXPIRED": return { subject: copy.expired, intro: locale === "es" ? "La propuesta de reunión venció antes de ser aceptada." : "This meeting proposal expired before it was accepted." };
    default: { const exhaustive: never = template; throw new Error(`Unknown email template: ${exhaustive}`); }
  }
}
function rowsHtml(rows: readonly [string, string][]) {
  return rows.map(([label, value]) => `<tr><td style="padding:7px 0;color:#737373;font-size:14px;vertical-align:top;width:120px">${escapeHtml(label)}</td><td style="padding:7px 0;color:#171717;font-size:14px;vertical-align:top">${escapeHtml(value)}</td></tr>`).join("");
}
function actionHtml(links: readonly EmailActionLink[], copy: Copy) {
  if (!links.length) return "";
  const buttons = links.map((link) => `<tr><td style="padding:0 0 10px"><a href="${escapeHtml(link.url)}" style="background:#171717;border:1px solid #171717;border-radius:6px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:20px;padding:11px 18px;text-decoration:none">${escapeHtml(link.label)}</a><br><span style="color:#737373;font-family:Arial,sans-serif;font-size:12px;line-height:18px;word-break:break-all">${escapeHtml(link.url)}</span></td></tr>`).join("");
  return `<tr><td style="padding:28px 32px 0"><h2 style="color:#171717;font-family:Arial,sans-serif;font-size:16px;line-height:22px;margin:0 0 14px">${escapeHtml(copy.actions)}</h2><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${buttons}</table></td></tr>`;
}

export function composeMeetingEmail(input: ComposeMeetingEmailInput): ComposedMeetingEmail {
  const locale = localeFor(input.booking);
  const copy = COPY[locale];
  const { subject, intro } = subjectAndIntro(input.template, copy, input.booking, locale);
  const meeting = meetingValues(input.booking);
  const links = input.actionLinks ?? [];
  const audience = input.audience ?? (input.template === "MEETING_REQUESTED" ? "owner" : "visitor");
  const note = input.note?.trim() ? input.note : undefined;
  const meetingRows: [string, string][] = [[copy.date, meeting.date], [copy.time, meeting.time], [copy.timezone, meeting.timezone]];
  const visitorRows: [string, string][] = [[copy.name, input.booking.identity.name], [copy.email, input.booking.identity.email], [copy.phone, input.booking.identity.phone], [copy.reason, valueOr(resolveReasonLabel(input.booking, locale), copy.unavailable)], [copy.message, valueOr(input.booking.identity.message, copy.unavailable)]];
  const ownerBlock = audience === "owner" ? `<tr><td style="padding:28px 32px 0"><h2 style="color:#171717;font-family:Arial,sans-serif;font-size:16px;line-height:22px;margin:0 0 8px">${escapeHtml(copy.visitorDetails)}</h2><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${rowsHtml(visitorRows)}</table></td></tr>` : "";
  const noteBlock = note ? `<tr><td style="padding:20px 32px 0;color:#525252;font-family:Arial,sans-serif;font-size:14px;line-height:21px">${escapeHtml(note)}</td></tr>` : "";
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:0;background:#f5f5f5"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f5"><tr><td align="center" style="padding:28px 12px"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5"><tr><td style="background:#171717;padding:22px 32px"><span style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:2px">${escapeHtml(copy.brand)}</span></td></tr><tr><td style="padding:32px 32px 0"><h1 style="color:#171717;font-family:Arial,sans-serif;font-size:24px;line-height:32px;margin:0 0 12px">${escapeHtml(subject)}</h1><p style="color:#404040;font-family:Arial,sans-serif;font-size:16px;line-height:24px;margin:0">${escapeHtml(intro)}</p></td></tr><tr><td style="padding:28px 32px 0"><h2 style="color:#171717;font-family:Arial,sans-serif;font-size:16px;line-height:22px;margin:0 0 8px">${escapeHtml(copy.meeting)}</h2><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${rowsHtml(meetingRows)}</table></td></tr>${ownerBlock}${noteBlock}${actionHtml(links, copy)}<tr><td style="padding:28px 32px 32px;color:#737373;font-family:Arial,sans-serif;font-size:12px;line-height:18px">${escapeHtml(copy.footer)}</td></tr></table></td></tr></table></body></html>`;
  const visitorText = audience === "owner" ? `\n\n${copy.visitorDetails}:\n${visitorRows.map(([label, value]) => `${label}: ${value}`).join("\n")}` : "";
  const actionText = links.length ? `\n\n${copy.actions}:\n${links.map((link) => `- ${link.label}: ${link.url}`).join("\n")}` : "";
  const text = `${subject}\n\n${intro}\n\n${copy.meeting}:\n${meetingRows.map(([label, value]) => `${label}: ${value}`).join("\n")}${visitorText}${note ? `\n\n${note}` : ""}${actionText}\n\n${copy.footer}`;
  return { subject, html, text };
}
