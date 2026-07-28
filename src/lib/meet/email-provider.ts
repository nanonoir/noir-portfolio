import "server-only";

import type { BookingRecord } from "./booking-model";
import { meetLogger, normalizeErrorCause } from "./logger";

export const EMAIL_TEMPLATE_CODES = {
  MEETING_CONFIRMED: "MEETING_CONFIRMED",
  MEETING_REQUESTED: "MEETING_REQUESTED",
  MEETING_RECEIVED: "MEETING_RECEIVED",
  RESCHEDULE_PROPOSED: "RESCHEDULE_PROPOSED",
  MEETING_DECLINED: "MEETING_DECLINED",
  MEETING_CANCELLED: "MEETING_CANCELLED",
  MEETING_EXPIRED: "MEETING_EXPIRED",
} as const;

export type EmailTemplateCode = (typeof EMAIL_TEMPLATE_CODES)[keyof typeof EMAIL_TEMPLATE_CODES];

export const EMAIL_PROVIDER_ERROR_CODES = {
  EMAIL_PROVIDER_ERROR: "EMAIL_PROVIDER_ERROR",
} as const;

export type EmailProviderErrorCode = (typeof EMAIL_PROVIDER_ERROR_CODES)[keyof typeof EMAIL_PROVIDER_ERROR_CODES];

export interface MeetingEmailInput {
  booking: BookingRecord;
  payload: Readonly<Record<string, unknown>>;
  recipient: string;
  /** Nahuel-facing messages use the persisted validated visitor email. */
  replyTo?: string;
  /** Stable Resend idempotency key: template/booking/proposal version/recipient. */
  idempotencyKey?: string;
}

export interface SentMeetingEmail {
  idempotencyKey?: string;
  locale: BookingRecord["locale"];
  payload: Readonly<Record<string, unknown>>;
  recipient: string;
  replyTo?: string;
  template: EmailTemplateCode;
}

export interface EmailProviderSuccess {
  success: true;
}

export interface EmailProviderFailure {
  success: false;
  error: EmailProviderErrorCode;
}

export type EmailProviderResult = EmailProviderSuccess | EmailProviderFailure;

export interface EmailProvider {
  /** Phase 6 generic delivery entry point for all locale/template combinations. */
  send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult>;
  sendMeetingRequested(input: MeetingEmailInput): Promise<EmailProviderResult>;
  sendMeetingConfirmed(input: MeetingEmailInput): Promise<EmailProviderResult>;
  sendRescheduleProposed(input: MeetingEmailInput): Promise<EmailProviderResult>;
}

export class ResendMockProvider implements EmailProvider {
  readonly sentEmails: SentMeetingEmail[] = [];

  async sendMeetingRequested(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED, input);
  }

  async sendMeetingConfirmed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.MEETING_CONFIRMED, input);
  }

  async sendRescheduleProposed(input: MeetingEmailInput): Promise<EmailProviderResult> {
    return this.send(EMAIL_TEMPLATE_CODES.RESCHEDULE_PROPOSED, input);
  }

  async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
    try {
      this.capture(template, input);
      return { success: true };
    } catch (error) {
      meetLogger.error("email.mock.send_error", {
        bookingId: input.booking.id,
        cause: normalizeErrorCause(error),
        provider: "email",
      });
      return { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR };
    }
  }

  private capture(template: EmailTemplateCode, input: MeetingEmailInput) {
    this.sentEmails.push({
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      locale: input.booking.locale,
      payload: Object.freeze({ ...input.payload }),
      recipient: input.recipient,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      template,
    });
  }
}
