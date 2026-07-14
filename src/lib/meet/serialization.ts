import "server-only";

const MAX_ARRAY_ENTRIES = 100;
const MAX_DEPTH = 3;
const MAX_OBJECT_KEYS = 50;
const MAX_SERIALIZED_BYTES = 16 * 1024;

export const SAFE_SERIALIZATION_REASONS = {
  ARRAY_TOO_LARGE: "array_too_large",
  CYCLIC_VALUE: "cyclic_value",
  MAX_DEPTH_EXCEEDED: "max_depth_exceeded",
  OBJECT_TOO_LARGE: "object_too_large",
  OUTPUT_TOO_LARGE: "output_too_large",
  UNSUPPORTED_VALUE: "unsupported_value",
} as const;

export type SafeSerializationReason =
  (typeof SAFE_SERIALIZATION_REASONS)[keyof typeof SAFE_SERIALIZATION_REASONS];

export type SafeSerializationResult =
  | { safe: true; value: string }
  | { safe: false; reason: SafeSerializationReason };

export type SafeHashResult =
  | { safe: true; value: string }
  | { safe: false; reason: SafeSerializationReason };

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function serializeValue(value: unknown, depth: number, ancestors: Set<object>): SafeSerializationResult {
  if (value === null) return { safe: true, value: "null" };

  switch (typeof value) {
    case "string":
    case "boolean":
      return { safe: true, value: JSON.stringify(value) };
    case "number":
      return Number.isFinite(value)
        ? { safe: true, value: JSON.stringify(value) }
        : { safe: false, reason: SAFE_SERIALIZATION_REASONS.UNSUPPORTED_VALUE };
    case "undefined":
      return { safe: true, value: "undefined" };
    case "object":
      break;
    default:
      return { safe: false, reason: SAFE_SERIALIZATION_REASONS.UNSUPPORTED_VALUE };
  }

  if (depth > MAX_DEPTH) return { safe: false, reason: SAFE_SERIALIZATION_REASONS.MAX_DEPTH_EXCEEDED };

  const objectValue = value as object;

  if (ancestors.has(objectValue)) return { safe: false, reason: SAFE_SERIALIZATION_REASONS.CYCLIC_VALUE };
  ancestors.add(objectValue);

  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ENTRIES) return { safe: false, reason: SAFE_SERIALIZATION_REASONS.ARRAY_TOO_LARGE };

      const entries: string[] = [];
      for (const entry of value) {
        const serialized = serializeValue(entry, depth + 1, ancestors);
        if (!serialized.safe) return serialized;
        entries.push(serialized.value);
      }

      return { safe: true, value: `[${entries.join(",")}]` };
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length > MAX_OBJECT_KEYS) return { safe: false, reason: SAFE_SERIALIZATION_REASONS.OBJECT_TOO_LARGE };

    const entries: string[] = [];
    for (const key of keys) {
      const serialized = serializeValue(record[key], depth + 1, ancestors);
      if (!serialized.safe) return serialized;
      entries.push(`${JSON.stringify(key)}:${serialized.value}`);
    }

    return { safe: true, value: `{${entries.join(",")}}` };
  } finally {
    ancestors.delete(objectValue);
  }
}

export function safeStableSerialize(input: unknown): SafeSerializationResult {
  try {
    const result = serializeValue(input, 0, new Set());
    if (!result.safe) return result;

    return byteLength(result.value) <= MAX_SERIALIZED_BYTES
      ? result
      : { safe: false, reason: SAFE_SERIALIZATION_REASONS.OUTPUT_TOO_LARGE };
  } catch {
    return { safe: false, reason: SAFE_SERIALIZATION_REASONS.UNSUPPORTED_VALUE };
  }
}

function hash(value: string, seed: number) {
  let result = seed;

  for (const character of value) {
    result = Math.imul(result ^ character.charCodeAt(0), 0x45d9f3b);
    result ^= result >>> 16;
  }

  return (result >>> 0).toString(16).padStart(8, "0");
}

export function createSafeHash(input: unknown, prefix = ""): SafeHashResult {
  const serialized = safeStableSerialize(input);
  if (!serialized.safe) return serialized;

  return {
    safe: true,
    value: `${prefix}${[1, 2, 3, 4].map((seed) => hash(serialized.value, seed)).join("")}`,
  };
}
