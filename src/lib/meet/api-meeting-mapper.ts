import "server-only";

import type { BookingRequestDto } from "./dto";
import { bookingRequestSchema } from "./schemas";

const LEGACY_TIMEZONE = "America/Argentina/Buenos_Aires";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value) ?? "undefined";

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function hash(value: string, seed: number) {
  let result = seed;

  for (const character of value) {
    result = Math.imul(result ^ character.charCodeAt(0), 0x45d9f3b);
    result ^= result >>> 16;
  }

  return result >>> 0;
}

function createLegacyIdempotencyKey(payload: Record<string, unknown>) {
  const fingerprint = stableSerialize(payload);
  const hex = [0, 1, 2, 3].map((seed) => hash(fingerprint, seed + 1).toString(16).padStart(8, "0")).join("");
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
    idempotencyKey: createLegacyIdempotencyKey(payload),
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
