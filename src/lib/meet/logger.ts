import "server-only";

export interface NormalizedErrorCause {
  code?: string;
  message?: string;
  type: string;
}

export type MeetLogFields = Readonly<Record<string, string | number | boolean | NormalizedErrorCause | undefined>>;

const MAX_CAUSE_VALUE_LENGTH = 160;

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
    const message = trimCauseValue(cause.message);
    const type = trimCauseValue(cause.constructor.name) ?? "Error";

    return { type, ...(code ? { code } : {}), ...(message ? { message } : {}) };
  } catch {
    return { type: "Error" };
  }
}

export interface MeetLogger {
  error(event: string, fields?: MeetLogFields): void;
  info(event: string, fields?: MeetLogFields): void;
  warn(event: string, fields?: MeetLogFields): void;
}

/** Mock-safe boundary for future structured logging adapters. Never receives lead content or credentials. */
export class NoopMeetLogger implements MeetLogger {
  error() {}

  info() {}

  warn() {}
}

export const meetLogger: MeetLogger = new NoopMeetLogger();
