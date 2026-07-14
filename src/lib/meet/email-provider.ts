import "server-only";

import type { BookingRecord } from "./booking-model";
import { meetLogger, normalizeErrorCause } from "./logger";

export const EMAIL_TEMPLATE_CODES = {
  MEETING_CONFIRMED: "MEETING_CONFIRMED",
  MEETING_REQUESTED: "MEETING_REQUESTED",
  RESCHEDULE_PROPOSED: "RESCHEDULE_PROPOSED",
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
}

export interface SentMeetingEmail {
  locale: BookingRecord["locale"];
  payload: Readonly<Record<string, unknown>>;
  recipient: string;
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

  private async send(template: EmailTemplateCode, input: MeetingEmailInput): Promise<EmailProviderResult> {
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
      locale: input.booking.locale,
      payload: Object.freeze({ ...input.payload }),
      recipient: input.recipient,
      template,
    });
  }
}
