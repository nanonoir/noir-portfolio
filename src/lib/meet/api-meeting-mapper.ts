import "server-only";

import type { BookingRequestDto } from "./dto";
import { bookingRequestSchema } from "./schemas";

const LEGACY_TIMEZONE = "America/Argentina/Buenos_Aires";

function getLegacyOrigin(origin: unknown) {
  switch (origin) {
    case "Contacto":
      return "contact";
    case "Solicitud de servicio":
      return "service";
    case "Software a medida":
      return "custom_software";
    default:
      return origin;
  }
}

function getLegacyReason(reason: unknown) {
  if (reason === "project" || reason === "job" || reason === "general") {
    return reason;
  }

  return "general";
}

function normalizeLegacyMeetingRequest(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const payload = input as Record<string, unknown>;

  if (typeof payload.identity !== "undefined") {
    return input;
  }

  const meeting = payload.meeting;

  if (!meeting || typeof meeting !== "object" || Array.isArray(meeting)) {
    return input;
  }

  const schedule = meeting as Record<string, unknown>;
  const origin = getLegacyOrigin(payload.origin);
  const base = {
    type: payload.type,
    identity: {
      email: payload.email,
      message: payload.message,
      name: payload.name,
      phone: payload.phone,
    },
    idempotencyKey: crypto.randomUUID(),
    locale: "es-AR",
    meeting: {
      date: schedule.date,
      time: schedule.time,
      timezone: schedule.timezone ?? payload.timezone ?? LEGACY_TIMEZONE,
    },
    origin,
    proposalMetadata: {
      originVersion: "legacy-ui-v1",
      proposalVersion: "legacy-ui-v1",
      submittedAt: new Date().toISOString(),
    },
  };

  if (origin === "contact") {
    return { ...base, reason: getLegacyReason(payload.reason) };
  }

  if (origin === "custom_software") {
    const previousRequest = payload.previousRequest as Record<string, unknown> | undefined;
    return {
      ...base,
      previousRequest: {
        details: previousRequest?.details,
        service: "custom_software",
      },
      relatedService: "custom_software",
    };
  }

  const previousRequest = payload.previousRequest as Record<string, unknown> | undefined;
  return {
    ...base,
    previousRequest: {
      details: previousRequest?.details,
      service: previousRequest?.service,
    },
    relatedService: payload.relatedService,
  };
}

/** Route-only compatibility boundary for pre-canonical Contact, Service, and Custom payloads. */
export function mapMeetingApiPayload(input: unknown): BookingRequestDto | null {
  const parsed = bookingRequestSchema.safeParse(normalizeLegacyMeetingRequest(input));

  return parsed.success ? parsed.data : null;
}
