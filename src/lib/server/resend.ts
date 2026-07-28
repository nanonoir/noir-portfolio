import "server-only";
import { Resend } from "resend";

import { getEnv, requireEnv } from "./env";

/**
 * Resend client foundation.
 *
 * Phase 1 only wires the client. No email is sent here. Future Resend
 * adapters for the Meet email provider port will call `getResendClient()` and
 * keep all template rendering and SDK response handling inside the adapter.
 *
 * Server-only: the API key must never be exposed to the client bundle.
 */

let cachedClient: Resend | null = null;

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = requireEnv("RESEND_API_KEY");
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function isResendClientConfigured(): boolean {
  return Boolean(getEnv("RESEND_API_KEY"));
}