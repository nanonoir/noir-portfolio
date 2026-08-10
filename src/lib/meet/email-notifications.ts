import "server-only";

import { getEnv } from "@/lib/server/env";
import { buildActionLink } from "./action-links";
import type { IssuedActionToken } from "./action-tokens";
import type { BookingRecord } from "./booking-model";
import { deliverMeetingEmail, emailDeliveryKey } from "./email-delivery";
import {
  EMAIL_PROVIDER_ERROR_CODES,
  EMAIL_TEMPLATE_CODES,
  type EmailProvider,
  type EmailTemplateCode,
} from "./email-provider";
import type { BookingRepository } from "./booking-repository";
import type { EmailActionLink } from "./email-templates";
import type { ProviderFailureClass } from "./provider-failures";

export interface InitialNotificationResult {
  failureClass: ProviderFailureClass | null;
  record: BookingRecord;
}

/** Raw action tokens become links here and never enter logs or persistence. */

const ACTION_LABELS: Record<"en" | "es", Record<string, string>> = {
  en: {
    confirm: "Confirm meeting",
    propose: "Propose another time",
    decline: "Decline",
    accept_proposal: "Accept proposed time",
  },
  es: {
    confirm: "Confirmar reunión",
    propose: "Proponer otro horario",
    decline: "Rechazar",
    accept_proposal: "Aceptar horario propuesto",
  },
};

function lang(booking: BookingRecord): "en" | "es" {
  return booking.locale.toLowerCase().startsWith("es") ? "es" : "en";
}

function getOwnerRecipient(): string | null {
  return getEnv("CONTACT_TO_EMAIL") ?? null;
}

export function buildEmailActionLinks(
  booking: BookingRecord,
  tokens: readonly IssuedActionToken[],
): EmailActionLink[] {
  const labels = ACTION_LABELS[lang(booking)];
  return tokens.map((issued) => ({
    label: labels[issued.record.action] ?? issued.record.action,
    url: buildActionLink({
      meetingId: booking.id,
      action: issued.record.action,
      rawToken: issued.token,
    }),
  }));
}

export async function sendOwnerRequestNotification(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  ownerTokens: readonly IssuedActionToken[],
): Promise<BookingRecord> {
  const ownerRecipient = getOwnerRecipient();
  if (!ownerRecipient) {
    return markEmailConfigurationFailure(repository, booking);
  }
  const actionLinks = tryBuildActionLinks(booking, ownerTokens);
  if (!actionLinks) return markEmailConfigurationFailure(repository, booking);
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.MEETING_REQUESTED,
    booking,
    recipient: ownerRecipient,
    replyTo: booking.identity.email,
    payload: { actionLinks, audience: "owner" },
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, booking, ownerRecipient),
  });
}

/** Sends owner and visitor notifications with independent idempotency keys. */
export async function sendInitialRequestNotifications(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  ownerTokens: readonly IssuedActionToken[],
): Promise<InitialNotificationResult> {
  const ownerRecipient = getOwnerRecipient();
  const actionLinks = tryBuildActionLinks(booking, ownerTokens);
  const ownerResult = ownerRecipient && actionLinks?.length
    ? safeSend(provider, EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, {
      booking,
      recipient: ownerRecipient,
      replyTo: booking.identity.email,
      payload: { actionLinks, audience: "owner" },
      idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, booking, ownerRecipient),
    })
    : Promise.resolve({ success: false as const, error: ownerRecipient
      ? EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR
      : EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_CONFIGURATION });

  const visitorResult = safeSend(provider, EMAIL_TEMPLATE_CODES.MEETING_RECEIVED, {
    booking,
    recipient: booking.identity.email,
    payload: { audience: "visitor" },
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_RECEIVED, booking, booking.identity.email),
  });
  const [ownerSettled, visitorSettled] = await Promise.allSettled([ownerResult, visitorResult]);
  const ownerDelivery = ownerSettled.status === "fulfilled"
    ? ownerSettled.value
    : { success: false as const, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_TRANSIENT };
  const visitorDelivery = visitorSettled.status === "fulfilled"
    ? visitorSettled.value
    : { success: false as const, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_TRANSIENT };

  if (ownerDelivery.success && visitorDelivery.success) {
    return { failureClass: null, record: (await repository.updateProviderDelivery(booking.id, "email", {
      status: "completed",
    })) ?? booking };
  }

  const errorCode = !ownerDelivery.success
    ? ownerDelivery.error
    : !visitorDelivery.success
      ? visitorDelivery.error
      : EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR;
  return { failureClass: classifyEmailFailure(errorCode), record: (await repository.updateProviderDelivery(booking.id, "email", {
    errorCode,
    status: "failed",
  })) ?? booking };
}

async function safeSend(
  provider: EmailProvider,
  template: EmailTemplateCode,
  input: Parameters<EmailProvider["send"]>[1],
) {
  try {
    return await provider.send(template, input);
  } catch {
    return { success: false as const, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR };
  }
}

export async function sendVisitorReceivedAcknowledgement(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
): Promise<BookingRecord> {
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.MEETING_RECEIVED,
    booking,
    recipient: booking.identity.email,
    payload: {},
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_RECEIVED, booking, booking.identity.email),
  });
}

export async function sendRescheduleProposal(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  visitorTokens: readonly IssuedActionToken[],
): Promise<BookingRecord> {
  const actionLinks = tryBuildActionLinks(booking, visitorTokens);
  if (!actionLinks) return markEmailConfigurationFailure(repository, booking);
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED,
    booking,
    recipient: booking.identity.email,
    payload: { actionLinks, audience: "visitor" },
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED, booking, booking.identity.email),
  });
}

export async function sendOwnerRescheduleProposal(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  ownerTokens: readonly IssuedActionToken[],
): Promise<BookingRecord> {
  const ownerRecipient = getOwnerRecipient();
  if (!ownerRecipient) return markEmailConfigurationFailure(repository, booking);
  const actionLinks = tryBuildActionLinks(booking, ownerTokens);
  if (!actionLinks) return markEmailConfigurationFailure(repository, booking);
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED,
    booking,
    recipient: ownerRecipient,
    replyTo: booking.identity.email,
    payload: { actionLinks, audience: "owner" },
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED, booking, ownerRecipient),
  });
}

export async function sendMeetingConfirmation(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  visitorTokens: readonly IssuedActionToken[],
): Promise<BookingRecord> {
  const actionLinks = tryBuildActionLinks(booking, visitorTokens);
  if (!actionLinks) return markEmailConfigurationFailure(repository, booking);
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.MEETING_CONFIRMED,
    booking,
    recipient: booking.identity.email,
    payload: { actionLinks, audience: "visitor" },
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_CONFIRMED, booking, booking.identity.email),
  });
}

export async function sendDeclinedNotice(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
  recipient: string,
): Promise<BookingRecord> {
  return deliverSimple(provider, repository, EMAIL_TEMPLATE_CODES.MEETING_DECLINED, booking, recipient);
}

export async function sendOwnerDeclinedNotice(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
): Promise<BookingRecord> {
  const ownerRecipient = getOwnerRecipient();
  if (!ownerRecipient) return markEmailConfigurationFailure(repository, booking);
  return deliverMeetingEmail(provider, repository, {
    template: EMAIL_TEMPLATE_CODES.MEETING_DECLINED,
    booking,
    recipient: ownerRecipient,
    replyTo: booking.identity.email,
    payload: {},
    idempotencyKey: emailDeliveryKey(EMAIL_TEMPLATE_CODES.MEETING_DECLINED, booking, ownerRecipient),
  });
}

export async function sendCancelledNotice(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
): Promise<BookingRecord> {
  return deliverSimple(provider, repository, EMAIL_TEMPLATE_CODES.MEETING_CANCELLED, booking, booking.identity.email);
}

export async function sendExpiredNotice(
  provider: EmailProvider,
  repository: BookingRepository,
  booking: BookingRecord,
): Promise<BookingRecord> {
  return deliverSimple(provider, repository, EMAIL_TEMPLATE_CODES.MEETING_EXPIRED, booking, booking.identity.email);
}

async function deliverSimple(
  provider: EmailProvider,
  repository: BookingRepository,
  template: EmailTemplateCode,
  booking: BookingRecord,
  recipient: string,
): Promise<BookingRecord> {
  return deliverMeetingEmail(provider, repository, {
    template,
    booking,
    recipient,
    payload: {},
    idempotencyKey: emailDeliveryKey(template, booking, recipient),
  });
}

async function markEmailConfigurationFailure(
  repository: BookingRepository,
  booking: BookingRecord,
): Promise<BookingRecord> {
  return (await repository.updateProviderDelivery(booking.id, "email", {
    errorCode: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR,
    status: "failed",
  })) ?? booking;
}

function tryBuildActionLinks(
  booking: BookingRecord,
  tokens: readonly IssuedActionToken[],
): EmailActionLink[] | null {
  try {
    return buildEmailActionLinks(booking, tokens);
  } catch {
    // Missing APP_BASE_URL becomes a recoverable delivery failure.
    return null;
  }
}

function classifyEmailFailure(errorCode: string): ProviderFailureClass {
  if (errorCode === EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_CONFIGURATION) return "configuration";
  if (errorCode === EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_AUTHENTICATION) return "authentication";
  if (errorCode === EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_TIMEOUT) return "timeout";
  return "transient";
}
