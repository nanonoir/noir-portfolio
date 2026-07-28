import "server-only";

export interface NormalizedErrorCause {
  code?: string;
  type: string;
}

export type MeetLogFields = Readonly<Record<string, string | number | boolean | NormalizedErrorCause | undefined>>;

const MAX_CAUSE_VALUE_LENGTH = 160;
const SENSITIVE_FIELD_NAME = /(?:authorization|credential|email|identity|ip|message|oauth|password|payload|phone|providerDetails|reason|recipient|refresh|secret|token|visitor)/i;

function trimCauseValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_CAUSE_VALUE_LENGTH) : undefined;
}

export function normalizeErrorCause(cause: unknown): NormalizedErrorCause {
  if (!(cause instanceof Error)) return { type: "unknown" };

  try {
    const errorWithCode = cause as Error & { code?: unknown };
    const code = typeof errorWithCode.code === "string" || typeof errorWithCode.code === "number"
      ? trimCauseValue(String(errorWithCode.code))
      : undefined;
    const type = trimCauseValue(cause.constructor.name) ?? "Error";

    // Provider messages can contain request fragments, recipient addresses, or
    // other untrusted data. Preserve only a bounded error type/code for logs.
    return { type, ...(code ? { code } : {}) };
  } catch {
    return { type: "Error" };
  }
}

export interface MeetLogger {
  error(event: string, fields?: MeetLogFields): void;
  info(event: string, fields?: MeetLogFields): void;
  warn(event: string, fields?: MeetLogFields): void;
}

/**
 * No-op logger for test environments. Never emits output.
 * Used by callers that explicitly need a silent logger (e.g. diagnostic scripts,
 * test harnesses). Not used for the module-level singleton in production.
 */
export class NoopMeetLogger implements MeetLogger {
  // Methods accept the same optional parameters as the `MeetLogger` interface
  // so callers can pass event/fields without TypeScript complaining about
  // "Expected 0 arguments, but got 2". The no-op implementation ignores them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(_event?: string, _fields?: MeetLogFields) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_event?: string, _fields?: MeetLogFields) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(_event?: string, _fields?: MeetLogFields) {}
}

/**
 * Production-safe structured logger that routes to `console.error` / `console.warn`
 * / `console.info`. Fields are serialized as a flat JSON object so they appear as
 * structured key-value pairs in Vercel / Node runtime logs.
 *
 * PII / secret safety: the logger drops fields with sensitive names as a
 * defense-in-depth boundary. `normalizeErrorCause` also strips provider messages
 * and raw error details before fields reach this logger.
 */
class ConsoleMeetLogger implements MeetLogger {
  private serialize(event: string, fields?: MeetLogFields): string {
    const base: Record<string, unknown> = { event, operation: event };
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && !SENSITIVE_FIELD_NAME.test(k)) base[k] = v;
      }
    }
    // Preserve existing callers while publishing a stable, documented schema
    // for manual operations. Both aliases remain non-sensitive correlations.
    if (typeof base.bookingId === "string" && base.meetingId === undefined) base.meetingId = base.bookingId;
    if (typeof base.code === "string" && base.errorCode === undefined) base.errorCode = base.code;
    return JSON.stringify(base);
  }

  error(event: string, fields?: MeetLogFields) {
    console.error(this.serialize(event, fields));
  }

  info(event: string, fields?: MeetLogFields) {
    console.info(this.serialize(event, fields));
  }

  warn(event: string, fields?: MeetLogFields) {
    console.warn(this.serialize(event, fields));
  }
}

/**
 * Module-level singleton logger.
 *
 * - In test environments (`NODE_ENV === "test"`): no-op, so test output stays
 *   clean and no real I/O occurs.
 * - In all other environments (development, production, preview): console-based
 *   structured logger that routes to platform log sinks (Vercel, Node stdout).
 *
 * Callers import and use `meetLogger` directly — never construct a logger
 * themselves unless they have an explicit reason (e.g. `BookingService` accepts
 * a `MeetLogger` parameter for testability).
 */
export const meetLogger: MeetLogger =
  process.env.NODE_ENV === "test"
    ? new NoopMeetLogger()
    : new ConsoleMeetLogger();
