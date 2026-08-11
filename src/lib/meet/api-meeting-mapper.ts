import "server-only";

import type { BookingRequestDto } from "./dto";
import { bookingRequestSchema } from "./schemas";
import { createSafeHash, safeStableSerialize } from "./serialization";

const LEGACY_TIMEZONE = "America/Argentina/Buenos_Aires";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function createLegacyIdempotencyKey(payload: Record<string, unknown>) {
  const identity = payload.identity as Record<string, unknown> | undefined;
  const meeting = payload.meeting as Record<string, unknown> | undefined;
  const previousRequest = payload.previousRequest as Record<string, unknown> | undefined;
  const semanticPayload = payload.origin === "contact"
    ? {
      identity: { email: normalizeEmail(identity?.email) },
      meeting: { date: meeting?.date, time: meeting?.time, timezone: meeting?.timezone },
      origin: payload.origin,
      reason: payload.reason,
    }
    : {
      identity: { email: normalizeEmail(identity?.email) },
      meeting: { date: meeting?.date, time: meeting?.time, timezone: meeting?.timezone },
      origin: payload.origin,
      previousRequest: { details: previousRequest?.details, service: previousRequest?.service },
      relatedService: payload.relatedService,
    };
  const hash = createSafeHash(semanticPayload);
  if (!hash.safe) return null;

  const hex = hash.value;
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
}

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
    const normalized = { ...base, reason: getLegacyReason(payload.reason) };
    const idempotencyKey = createLegacyIdempotencyKey(normalized);
    return idempotencyKey ? { ...normalized, idempotencyKey } : null;
  }

  if (origin === "custom_software") {
    const previousRequest = payload.previousRequest as Record<string, unknown> | undefined;
    const normalized = {
      ...base,
      previousRequest: {
        details: previousRequest?.details,
        service: "custom_software",
      },
      relatedService: "custom_software",
    };
    const idempotencyKey = createLegacyIdempotencyKey(normalized);
    return idempotencyKey ? { ...normalized, idempotencyKey } : null;
  }

  const previousRequest = payload.previousRequest as Record<string, unknown> | undefined;
  const normalized = {
    ...base,
    previousRequest: {
      details: previousRequest?.details,
      service: previousRequest?.service,
    },
    relatedService: payload.relatedService,
  };
  const idempotencyKey = createLegacyIdempotencyKey(normalized);
  return idempotencyKey ? { ...normalized, idempotencyKey } : null;
}

/** Route-only compatibility boundary for pre-canonical Contact, Service, and Custom payloads. */
export function mapMeetingApiPayload(input: unknown): BookingRequestDto | null {
  if (!safeStableSerialize(input).safe) return null;

  const normalized = normalizeLegacyMeetingRequest(input);
  if (!normalized) return null;

  const parsed = bookingRequestSchema.safeParse(normalized);

  return parsed.success ? parsed.data : null;
}
