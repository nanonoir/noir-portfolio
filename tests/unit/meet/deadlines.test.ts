import { describe, expect, it } from "vitest";

import {
  ACTION_TOKEN_PROCESSING_LEASE_MS,
  CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS,
  DELIVERY_RETRY_STATES,
  FIRESTORE_RATE_LIMIT_TIMEOUT_MS,
  GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS,
  GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS,
  VERCEL_FUNCTION_TIMEOUT_MS,
} from "@/lib/meet/deadlines";

describe("meet deadline and recovery policy", () => {
  it("reserves the required provider and Firestore recovery margins", () => {
    expect(VERCEL_FUNCTION_TIMEOUT_MS).toBe(10_000);
    expect(GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS).toBe(3_500);
    expect(GOOGLE_CALENDAR_WEBHOOK_TIMEOUT_MS).toBe(GOOGLE_CALENDAR_OPERATION_TIMEOUT_MS);
    expect(FIRESTORE_RATE_LIMIT_TIMEOUT_MS).toBe(1_500);
    expect(CALENDAR_WEBHOOK_NOTIFICATION_LEASE_MS).toBe(5_000);
    expect(ACTION_TOKEN_PROCESSING_LEASE_MS).toBe(7_000);
    expect(ACTION_TOKEN_PROCESSING_LEASE_MS).toBeLessThan(VERCEL_FUNCTION_TIMEOUT_MS);
  });

  it("documents the truthful provider delivery and replay states", () => {
    expect(DELIVERY_RETRY_STATES).toEqual({
      COMPLETED: "completed",
      FAILED: "failed",
      PENDING: "pending",
      PROCESSING: "processing",
      RETRYABLE: "retryable",
    });
  });
});
