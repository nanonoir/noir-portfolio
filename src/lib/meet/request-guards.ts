import "server-only";
import { createHash } from "node:crypto";

import { isFirebaseConfigured } from "@/lib/server/env";
import type { ActionTokenAction } from "./action-contract";
import { consumeFirestoreFixedWindow } from "./firestore-rate-limit";

export const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MAX_RATE_LIMIT_BUCKETS = 500;

export const REQUEST_GUARD_RESULTS = {
  ALLOWED: "allowed",
  INVALID_JSON: "invalid_json",
  TOO_LARGE: "too_large",
} as const;

export type RequestGuardResult =
  (typeof REQUEST_GUARD_RESULTS)[keyof typeof REQUEST_GUARD_RESULTS];

export interface JsonRequestReadResult {
  payload?: unknown;
  result: RequestGuardResult;
}

export interface TextRequestReadResult {
  result: RequestGuardResult;
  text?: string;
}

export interface FixedWindowLimit {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  startedAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export const PUBLIC_MEETING_RATE_LIMIT: FixedWindowLimit = {
  maxRequests: 10,
  windowMs: 60_000,
};

export const PUBLIC_ACTION_RATE_LIMIT: FixedWindowLimit = {
  maxRequests: 10,
  windowMs: 60_000,
};

function getContentLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim();
  return address && address.length <= 128 ? address : "unknown";
}

function hashRateLimitIdentity(identity: string): string {
  return createHash("sha256").update(identity, "utf8").digest("hex");
}

function pruneRateLimitBuckets(now: number, windowMs: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.startedAt > windowMs) {
      rateLimitBuckets.delete(key);
    }
  }
  if (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    if (typeof oldestKey === "string") rateLimitBuckets.delete(oldestKey);
  }
}

export async function isRateLimitAllowed(request: Request, limit: FixedWindowLimit): Promise<boolean> {
  const key = getClientKey(request);
  if (isFirebaseConfigured()) {
    try {
      return await consumeFirestoreFixedWindow(key, limit.maxRequests, limit.windowMs);
    } catch {
      // Preserve bounded local protection when Firestore is temporarily unavailable.
    }
  }
  const now = Date.now();
  pruneRateLimitBuckets(now, limit.windowMs);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now - bucket.startedAt >= limit.windowMs) {
    rateLimitBuckets.set(key, { count: 1, startedAt: now });
    return true;
  }
  if (bucket.count >= limit.maxRequests) return false;
  bucket.count += 1;
  return true;
}

/**
 * Bounds public action previews and consumes per caller, meeting, and action.
 * The raw IP and opaque token never reach rate-limit storage, logs, or responses.
 */
export async function isActionRateLimitAllowed(
  request: Request,
  meetingId: string,
  action: ActionTokenAction,
): Promise<boolean> {
  const identity = hashRateLimitIdentity(`${getClientKey(request)}:${meetingId}:${action}`);

  if (isFirebaseConfigured()) {
    try {
      return await consumeFirestoreFixedWindow(
        identity,
        PUBLIC_ACTION_RATE_LIMIT.maxRequests,
        PUBLIC_ACTION_RATE_LIMIT.windowMs,
      );
    } catch {
      // Keep the bounded process-local fallback when Firestore is unavailable.
    }
  }

  const now = Date.now();
  pruneRateLimitBuckets(now, PUBLIC_ACTION_RATE_LIMIT.windowMs);
  const bucket = rateLimitBuckets.get(identity);

  if (!bucket || now - bucket.startedAt >= PUBLIC_ACTION_RATE_LIMIT.windowMs) {
    rateLimitBuckets.set(identity, { count: 1, startedAt: now });
    return true;
  }
  if (bucket.count >= PUBLIC_ACTION_RATE_LIMIT.maxRequests) return false;
  bucket.count += 1;
  return true;
}

export function hasTriggeredHoneypot(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const value = (payload as Record<string, unknown>).website_url;
  return typeof value === "string" && value.trim().length > 0;
}

export async function readBoundedTextRequest(request: Request): Promise<TextRequestReadResult> {
  const declaredLength = getContentLength(request);
  if (declaredLength !== null && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return { result: REQUEST_GUARD_RESULTS.TOO_LARGE };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) {
      return { result: REQUEST_GUARD_RESULTS.TOO_LARGE };
    }
    return { result: REQUEST_GUARD_RESULTS.ALLOWED, text };
  } catch {
    return { result: REQUEST_GUARD_RESULTS.INVALID_JSON };
  }
}

export async function readBoundedJsonRequest(request: Request): Promise<JsonRequestReadResult> {
  const body = await readBoundedTextRequest(request);
  if (body.result !== REQUEST_GUARD_RESULTS.ALLOWED) return body;

  try {
    return { payload: JSON.parse(body.text ?? "") as unknown, result: REQUEST_GUARD_RESULTS.ALLOWED };
  } catch {
    return { result: REQUEST_GUARD_RESULTS.INVALID_JSON };
  }
}
