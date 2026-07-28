import "server-only";

import type { BookingRecord } from "./booking-model";
import type {
  EmailProvider,
  EmailTemplateCode,
  MeetingEmailInput,
} from "./email-provider";
import { EMAIL_PROVIDER_ERROR_CODES } from "./email-provider";
import type { BookingRepository } from "./booking-repository";
import { meetLogger } from "./logger";

/**
 * Phase 6 delivery/persistence boundary.
 *
 * Calls the selected email provider with a stable template+booking idempotency
 * key, then persists the aggregate `emailDelivery` status using the existing
 * BookingRepository provider-delivery port. A failure never rolls back the
 * booking/status/action token; `updateProviderDelivery(... failed)` appends the
 * existing immutable `provider_failed` audit event. A later success after a
 * failure appends `provider_recovered` through the same repository contract.
 */

export interface DeliverMeetingEmailInput {
  template: EmailTemplateCode;
  booking: BookingRecord;
  recipient: string;
  replyTo?: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
}

export async function deliverMeetingEmail(
  provider: EmailProvider,
  repository: BookingRepository,
  input: DeliverMeetingEmailInput,
): Promise<BookingRecord> {
  const providerInput: MeetingEmailInput = {
    booking: input.booking,
    recipient: input.recipient,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
  };
  let result: Awaited<ReturnType<EmailProvider["send"]>>;
  try {
    result = await provider.send(input.template, providerInput);
  } catch {
    // A provider transport exception has the same durable product outcome as a
    // negative provider response: the state transition remains authoritative,
    // delivery is marked retryable, and a compatible token replay retries only
    // the email. Never leak this secondary failure as an action-route 503.
    result = { success: false, error: EMAIL_PROVIDER_ERROR_CODES.EMAIL_PROVIDER_ERROR };
  }

  if (result.success) {
    return (await repository.updateProviderDelivery(input.booking.id, "email", {
      status: "completed",
    })) ?? input.booking;
  }

  meetLogger.warn("booking.provider_failed", {
    bookingId: input.booking.id,
    deliveryState: "failed",
    errorCode: result.error,
    provider: "email",
    template: input.template,
  });
  return (await repository.updateProviderDelivery(input.booking.id, "email", {
    errorCode: result.error,
    status: "failed",
  })) ?? input.booking;
}

/** Stable, bounded idempotency key for Resend's 24h idempotency window. */
export function emailDeliveryKey(
  template: EmailTemplateCode,
  booking: BookingRecord,
  recipient: string,
): string {
  const recipientKey = recipient.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
  return `${template}/${booking.id}/${booking.proposalVersion}/${recipientKey}`.slice(0, 256);
}
