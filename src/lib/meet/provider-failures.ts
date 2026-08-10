import "server-only";

export const PROVIDER_FAILURE_CLASSES = {
  AUTHENTICATION: "authentication",
  CONFIGURATION: "configuration",
  TIMEOUT: "timeout",
  TRANSIENT: "transient",
} as const;

export type ProviderFailureClass = (typeof PROVIDER_FAILURE_CLASSES)[keyof typeof PROVIDER_FAILURE_CLASSES];
