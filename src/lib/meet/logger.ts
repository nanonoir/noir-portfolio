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

/** Silent logger for tests and diagnostic callers. */
export class NoopMeetLogger implements MeetLogger {
  // Keep the interface parameters so callers can pass event fields in tests.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(_event?: string, _fields?: MeetLogFields) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_event?: string, _fields?: MeetLogFields) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(_event?: string, _fields?: MeetLogFields) {}
}

/** Structured logger that filters sensitive fields before writing platform logs. */
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

/** Shared logger singleton; tests use the silent implementation. */
export const meetLogger: MeetLogger =
  process.env.NODE_ENV === "test"
    ? new NoopMeetLogger()
    : new ConsoleMeetLogger();
