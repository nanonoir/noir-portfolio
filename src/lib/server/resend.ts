import "server-only";
import { Resend } from "resend";

import { getEnv, requireEnv } from "./env";

/** Server-only Resend client; the API key never enters client bundles. */

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
