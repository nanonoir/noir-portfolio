import "server-only";

import { composeLeadEmail } from "./email-templates";
import type { LeadRecord } from "./lead-model";
import { getEnv } from "@/lib/server/env";
import { getResendClient, isResendClientConfigured } from "@/lib/server/resend";

const DEFAULT_FROM = "Nahuel Noir Portfolio <onboarding@resend.dev>";

function isBackendE2EProviderMock() {
  return process.env.MEET_BACKEND_E2E === "1"
    && process.env.FIREBASE_PROJECT_ID === "demo-noir-portfolio"
    && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export const LEAD_EMAIL_ERROR_CODES = {
  EMAIL_UNAVAILABLE: "EMAIL_UNAVAILABLE",
} as const;

export type LeadEmailResult =
  | { success: true }
  | { error: (typeof LEAD_EMAIL_ERROR_CODES)[keyof typeof LEAD_EMAIL_ERROR_CODES]; success: false };

export async function sendLeadOwnerNotification(lead: LeadRecord): Promise<LeadEmailResult> {
  // The Playwright backend lane reaches the real route/parser/guard/schema and
  // stops only at the Resend provider boundary. No email is sent externally.
  if (isBackendE2EProviderMock()) return { success: true };

  const recipient = getEnv("CONTACT_TO_EMAIL");
  if (!recipient?.trim() || !isResendClientConfigured()) {
    return { success: false, error: LEAD_EMAIL_ERROR_CODES.EMAIL_UNAVAILABLE };
  }

  const composed = composeLeadEmail(lead);
  try {
    const { error } = await getResendClient().emails.send(
      {
        from: getEnv("CONTACT_FROM_EMAIL") ?? DEFAULT_FROM,
        headers: { "X-Lead-Type": lead.type },
        html: composed.html,
        replyTo: lead.email,
        subject: composed.subject,
        text: composed.text,
        to: [recipient],
      },
      { idempotencyKey: `${lead.type}/${lead.idempotencyKey}/${recipient.trim().toLowerCase()}`.slice(0, 256) },
    );

    return error ? { success: false, error: LEAD_EMAIL_ERROR_CODES.EMAIL_UNAVAILABLE } : { success: true };
  } catch {
    return { success: false, error: LEAD_EMAIL_ERROR_CODES.EMAIL_UNAVAILABLE };
  }
}
