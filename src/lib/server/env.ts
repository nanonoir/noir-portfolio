import "server-only";

/**
 * Server-only environment variable accessors.
 *
 * These helpers keep all credential access explicit and ensure the codebase
 * never reaches for `process.env.NEXT_PUBLIC_*` for server secrets. No value
 * ever leaves through these helpers; they only return strings or booleans that
 * indicate whether a value is configured.
 */

const REQUIRED_ENV_KEYS = [
  "APP_BASE_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "RESEND_API_KEY",
  "CONTACT_TO_EMAIL",
  "CONTACT_FROM_EMAIL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_ID",
  "GOOGLE_CALENDAR_WEBHOOK_CHANNEL_ID",
  "GOOGLE_CALENDAR_WEBHOOK_RESOURCE_ID",
  "GOOGLE_CALENDAR_WEBHOOK_TOKEN",
  "GOOGLE_OAUTH_ADMIN_SECRET",
  "RECOVERY_ENCRYPTION_KEY",
] as const;

export type ServerEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

export function getEnv(key: ServerEnvKey): string | undefined {
  return process.env[key];
}

export function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required server environment variable: ${key}`);
  }
  return value;
}

/**
 * Returns a `{ key: boolean }` map indicating which required envs are present
 * without exposing any value. Intended for health checks and operational audits
 * only; never serialize the underlying values to a response.
 */
export function getEnvAudit(): Record<ServerEnvKey, boolean> {
  return REQUIRED_ENV_KEYS.reduce(
    (acc, key) => {
      const value = process.env[key];
      acc[key] = Boolean(value && value.trim() !== "");
      return acc;
    },
    {} as Record<ServerEnvKey, boolean>,
  );
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    getEnv("FIREBASE_PROJECT_ID") &&
      getEnv("FIREBASE_CLIENT_EMAIL") &&
      getEnv("FIREBASE_PRIVATE_KEY"),
  );
}

/**
 * Limits the local real-backend browser lane to its demo Firestore emulator
 * composition. This explicit opt-in wins over any `.env` values Next dev loads.
 */
export function isBackendE2ETestComposition(): boolean {
  return process.env.MEET_BACKEND_E2E === "1"
    && process.env.FIREBASE_PROJECT_ID === "demo-noir-portfolio"
    && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export function isResendConfigured(): boolean {
  return Boolean(getEnv("RESEND_API_KEY"));
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getEnv("GOOGLE_CLIENT_ID") && getEnv("GOOGLE_CLIENT_SECRET") && getEnv("APP_BASE_URL"));
}

export function isGoogleOAuthAdminProtected(): boolean {
  return Boolean(getEnv("GOOGLE_OAUTH_ADMIN_SECRET"));
}

export function isGoogleCalendarWebhookConfigured(): boolean {
  return Boolean(
    getEnv("GOOGLE_CALENDAR_WEBHOOK_CHANNEL_ID") &&
      getEnv("GOOGLE_CALENDAR_WEBHOOK_RESOURCE_ID") &&
      getEnv("GOOGLE_CALENDAR_WEBHOOK_TOKEN"),
  );
}
