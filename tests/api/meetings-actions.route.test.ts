import { beforeEach, describe, expect, it, vi } from "vitest";

import { createActionTokenRecord, createBookingRecordFixture } from "../helpers/booking-factory";

const mocks = vi.hoisted(() => ({
  consumeAction: vi.fn(),
  previewAction: vi.fn(),
}));

// The action service is the composition boundary. Parsing, schema validation,
// rate limiting, response builders, and logging stay real in these contracts.
vi.mock("@/lib/meet/composition", () => ({
  actionService: { consumeAction: mocks.consumeAction, previewAction: mocks.previewAction },
}));
vi.mock("@/lib/server/env", () => ({
  isBackendE2ETestComposition: () => false,
  isFirebaseConfigured: () => false,
}));

const context = { params: Promise.resolve({ id: "meet-1" }) };
let requestSequence = 0;

function actionRequest(path: string, init: RequestInit = {}) {
  requestSequence += 1;
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      "x-vercel-forwarded-for": `203.0.113.${requestSequence}`,
      ...init.headers,
    },
  });
}

function actionResult(status: "ok" | "replayed" = "ok") {
  return {
    consumedTokenId: "token-hash-1",
    issuedTokens: [],
    meeting: createBookingRecordFixture({ id: "meet-1" }),
    status,
  };
}

describe("meeting action HTTP contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses real GET token parsing for neutral and tokenized previews", async () => {
    mocks.previewAction.mockResolvedValue({
      meeting: createBookingRecordFixture({ id: "meet-1" }),
      ok: true,
      record: createActionTokenRecord({ meetingId: "meet-1" }),
    });
    const { GET } = await import("@/app/api/meetings/[id]/confirm/route");

    const neutral = await GET(actionRequest("/api/meetings/meet-1/confirm"), context);
    const preview = await GET(actionRequest("/api/meetings/meet-1/confirm?token=raw-token"), context);

    expect(neutral.status).toBe(200);
    expect(neutral.headers.get("content-type")).toContain("text/html");
    expect(await neutral.text()).toContain("noindex,nofollow");
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("meet-1");
    expect(mocks.previewAction).toHaveBeenCalledWith({ meetingId: "meet-1", rawToken: "raw-token", expectedAction: "confirm" });
  });

  it("maps real JSON bodies to consumed, invalid, expired, and replayed action contracts", async () => {
    const { POST } = await import("@/app/api/meetings/[id]/confirm/route");
    mocks.consumeAction
      .mockResolvedValueOnce(actionResult())
      .mockResolvedValueOnce({ error: "LINK_NOT_ACTIVE", status: "rejected" })
      .mockResolvedValueOnce({ error: "LINK_NOT_ACTIVE", status: "rejected" })
      .mockResolvedValueOnce(actionResult("replayed"));

    const consumed = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "valid-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);
    const invalid = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "invalid-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);
    const expired = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "expired-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);
    const replayed = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "replayed-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(consumed.status).toBe(200);
    expect(await consumed.json()).toMatchObject({ action: "confirm", meetingId: "meet-1", status: "ok", success: true });
    for (const response of [invalid, expired]) {
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ success: false, error: "LINK_NOT_ACTIVE", reason: "not_found" });
    }
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toMatchObject({ action: "confirm", status: "replayed", success: true });
  });

  it("returns retryable 503 rather than confirmed success while Calendar creation is pending", async () => {
    mocks.consumeAction.mockResolvedValue({
      error: "PROVIDER_UNAVAILABLE",
      meeting: createBookingRecordFixture({ id: "meet-1" }),
      status: "pending",
    });
    const { POST } = await import("@/app/api/meetings/[id]/confirm/route");

    const response = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "valid-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "PROVIDER_UNAVAILABLE", success: false });
  });

  it("rejects empty, invalid, and oversized real request bodies before the composition boundary", async () => {
    const { POST } = await import("@/app/api/meetings/[id]/confirm/route");

    const empty = await POST(actionRequest("/api/meetings/meet-1/confirm", { method: "POST" }), context);
    const invalidJson = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: "{not-json",
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);
    const oversized = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "x".repeat(33 * 1024) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(empty.status).toBe(410);
    expect(await empty.json()).toEqual({ success: false, error: "LINK_NOT_ACTIVE", reason: "not_found" });
    for (const response of [invalidJson, oversized]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: "INVALID_PAYLOAD", reason: "invalid_payload" });
    }
    expect(mocks.consumeAction).not.toHaveBeenCalled();
  });

  it("uses real form parsing and payload validation for propose and decline routes", async () => {
    const { POST: propose } = await import("@/app/api/meetings/[id]/propose/route");
    const { POST: decline } = await import("@/app/api/meetings/[id]/decline/route");
    mocks.consumeAction.mockResolvedValue(actionResult());
    const form = new URLSearchParams({
      proposedSlot: JSON.stringify({ date: "2026-08-10", time: "10:00", visitorTimezone: "UTC" }),
      token: "proposal-token",
    });

    const proposed = await propose(actionRequest("/api/meetings/meet-1/propose", {
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }), context);
    const declined = await decline(actionRequest("/api/meetings/meet-1/decline", {
      body: new URLSearchParams({ reason: "Not this week", token: "decline-token" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }), context);
    const invalidSlot = await propose(actionRequest("/api/meetings/meet-1/propose", {
      body: JSON.stringify({ proposedSlot: { date: "2026-08-10", time: "25:00", visitorTimezone: "UTC" }, token: "proposal-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(proposed.status).toBe(200);
    expect(declined.status).toBe(200);
    expect(invalidSlot.status).toBe(400);
    expect(await invalidSlot.json()).toEqual({ success: false, error: "INVALID_PAYLOAD", reason: "invalid_payload" });
    expect(mocks.consumeAction).toHaveBeenCalledWith(expect.objectContaining({
      expectedAction: "propose",
      payload: expect.objectContaining({ proposedSlot: { date: "2026-08-10", time: "10:00", visitorTimezone: "UTC" } }),
    }));
    expect(mocks.consumeAction).toHaveBeenCalledWith(expect.objectContaining({
      expectedAction: "decline",
      payload: expect.objectContaining({ reason: "Not this week" }),
    }));
  });

  it("keeps accept-proposal's JSON and decline's external HTTP contracts action-specific", async () => {
    const { POST: acceptProposal } = await import("@/app/api/meetings/[id]/accept-proposal/route");
    const { POST: decline } = await import("@/app/api/meetings/[id]/decline/route");
    mocks.consumeAction
      .mockResolvedValueOnce(actionResult())
      .mockResolvedValueOnce({ error: "SLOT_UNAVAILABLE", status: "slot_unavailable" });

    const accepted = await acceptProposal(actionRequest("/api/meetings/meet-1/accept-proposal", {
      body: JSON.stringify({ token: "visitor-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);
    const unavailable = await decline(actionRequest("/api/meetings/meet-1/decline", {
      body: JSON.stringify({ token: "decline-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ action: "accept_proposal", success: true });
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toEqual({ success: false, error: "SLOT_UNAVAILABLE", reason: "slot_unavailable" });
  });

  it("maps an unexpected composition failure to the stable 503 contract", async () => {
    const { POST } = await import("@/app/api/meetings/[id]/confirm/route");
    mocks.consumeAction.mockRejectedValueOnce(new Error("private provider details"));

    const response = await POST(actionRequest("/api/meetings/meet-1/confirm", {
      body: JSON.stringify({ token: "valid-token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }), context);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: "BOOKING_TEMPORARILY_UNAVAILABLE" });
  });

  it("enforces the real process-local rate limit on the eleventh request", async () => {
    const { POST } = await import("@/app/api/meetings/[id]/confirm/route");
    mocks.consumeAction.mockResolvedValue(actionResult());
    const ip = "198.51.100.44";

    const responses = await Promise.all(Array.from({ length: 11 }, () => POST(new Request("http://localhost/api/meetings/meet-rate/confirm", {
      body: JSON.stringify({ token: "same-token" }),
      headers: { "content-type": "application/json", "x-vercel-forwarded-for": ip },
      method: "POST",
    }), { params: Promise.resolve({ id: "meet-rate" }) })));

    expect(responses.slice(0, 10).every((response) => response.status === 200)).toBe(true);
    expect(responses[10].status).toBe(429);
    expect(await responses[10].json()).toEqual({ success: false, error: "RATE_LIMITED", reason: "rate_limit_exceeded" });
    expect(mocks.consumeAction).toHaveBeenCalledTimes(10);
  });
});
