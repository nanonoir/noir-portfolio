import "server-only";

import { GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS } from "@/lib/meet/deadlines";
import { getEnv } from "./env";
import { withBoundedTimeout } from "./bounded-timeout";
import { BoundedTimeoutError } from "./bounded-timeout";
import { getResendClient, isResendClientConfigured } from "./resend";
import {
  EMAIL_PROVIDER_ERROR_CODES,
  EMAIL_TEMPLATE_CODES,
  type EmailProvider,
  type EmailProviderResult,
  type EmailTemplateCode,
  type MeetingEmailInput,
} from "@/lib/meet/email-provider";
import { composeMeetingEmail, type EmailActionLink } from "@/lib/meet/email-templates";
import { meetLogger, normalizeErrorCause } from "@/lib/meet/logger";

/** Server-only adapter; raw action tokens are never logged or persisted. */

const DEFAULT_FROM = "Nahuel Noir Portfolio <onboarding@resend.dev>";

export function isResendEmailConfigured(): boolean {
  // Use the Resend sandbox sender when no custom sender is configured.
  return isResendClientConfigured();
}

export class ResendEmailProvider implements EmailProvider {
  async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
    try {
      if (!isResendClientConfigured()) {
        return { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_CONFIGURATION };
      }

      const actionLinks = readActionLinks(input.payload);
      const composed = composeMeetingEmail({
        template,
        booking: input.booking,
        actionLinks,
        audience: readAudience(input.payload),
        note: readOptionalNote(input.payload),
      });
      const from = getEnv("CONTACT_FROM_EMAIL") ?? DEFAULT_FROM;
      const idempotencyKey = input.idempotencyKey ?? buildEmailIdempotencyKey(template, input);

      const { error } = await withBoundedTimeout(
        () => getResendClient().emails.send(
          {
            from,
            to: [input.recipient],
            ...(input.replyTo ? { replyTo: input.replyTo } : {}),
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: {
              "X-Meet-Template": template,
              "X-Meet-Booking": input.booking.id,
            },
          },
          { idempotencyKey },
        ),
        GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS,
      );

      if (error) {
        // Provider details, recipients, links, and tokens stay out of logs.
        meetLogger.warn("email.resend.send_failed", {
          bookingId: input.booking.id,
          provider: "email",
          template,
        });
        return { success: false, error: classifyResendFailure(error) };
      }

      return { success: true };
    } catch (error) {
      meetLogger.error("email.resend.send_error", {
        bookingId: input.booking.id,
        cause: normalizeErrorCause(error),
        provider: "email",
        template,
      });
      return { success: false, error: classifyResendFailure(error) };
    }
  }

  async sendMeetingRequested(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, input);
  }

  async sendMeetingConfirmed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_CONFIRMED, input);
  }

  async sendRescheduleProposed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED, input);
  }
}

/** Fails delivery without fabricating success when Resend is unavailable. */
export class UnavailableEmailProvider implements EmailProvider {
  async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
    void template;
    void input;
    return { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_CONFIGURATION };
  }

  async sendMeetingRequested(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, input);
  }

  async sendMeetingConfirmed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_CONFIRMED, input);
  }

  async sendRescheduleProposed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED, input);
  }
}

export function buildEmailIdempotencyKey(template: EmailTemplateCode, input: MeetingEmailInput): string {
  const recipientKey = input.recipient.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
  return `${template}/${input.booking.id}/${input.booking.proposalVersion}/${recipientKey}`.slice(0, 256);
}

function readActionLinks(payload: Readonly<Record<string, unknown>>): EmailActionLink[] {
  const raw = payload.actionLinks;
  if (!Array.isArray(raw)) return [];
  const links: EmailActionLink[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const label = (item as { label?: unknown }).label;
    const url = (item as { url?: unknown }).url;
    if (typeof label === "string" && typeof url === "string") {
      links.push({ label, url });
    }
  }
  return links;
}

function classifyResendFailure(error: unknown) {
  if (error instanceof BoundedTimeoutError) return EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_TIMEOUT;
  if (isAuthenticationFailure(error)) return EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_AUTHENTICATION;
  return EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_TRANSIENT;
}

function isAuthenticationFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { statusCode?: unknown; status?: unknown }).statusCode
    ?? (error as { status?: unknown }).status;
  return status === 401 || status === 403 || (typeof (error as { message?: unknown }).message === "string"
    && /invalid[_ -]?api|unauthori[sz]ed|forbidden|credential/i.test((error as { message: string }).message));
}

function readOptionalNote(payload: Readonly<Record<string, unknown>>): string | undefined {
  return typeof payload.note === "string" ? payload.note : undefined;
}

function readAudience(payload: Readonly<Record<string, unknown>>): "owner" | "visitor" | undefined {
  return payload.audience === "owner" || payload.audience === "visitor" ? payload.audience : undefined;
}
