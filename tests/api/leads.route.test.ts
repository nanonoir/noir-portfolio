import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendLeadOwnerNotification: vi.fn() }));

vi.mock("@/lib/leads/resend-lead-email-provider", () => ({
  sendLeadOwnerNotification: mocks.sendLeadOwnerNotification,
}));
vi.mock("@/lib/server/env", () => ({
  isBackendE2ETestComposition: () => false,
  isFirebaseConfigured: () => false,
}));

let requestSequence = 0;

function request(body: BodyInit | null, init: RequestInit = {}) {
  requestSequence += 1;
  return new Request("http://localhost/api/leads", {
    ...init,
    body,
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": `198.51.100.${requestSequence}`,
      ...init.headers,
    },
    method: "POST",
  });
}

const validLead = {
  email: "visitor@example.com",
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  locale: "en",
  message: "I would like to discuss a project.",
  type: "contact_message",
};

describe("lead submission HTTP contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendLeadOwnerNotification.mockResolvedValue({ success: true });
  });

  it("maps a real valid JSON payload through the lead schema before the Resend boundary", async () => {
    const { POST } = await import("@/app/api/leads/route");

    const response = await POST(request(JSON.stringify(validLead)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.sendLeadOwnerNotification).toHaveBeenCalledWith(expect.objectContaining({
      ...validLead,
      submittedAt: expect.any(String),
    }));
  });

  it("rejects real invalid JSON, oversized bodies, invalid payloads, and honeypots without delivery", async () => {
    const { POST } = await import("@/app/api/leads/route");

    const invalidJson = await POST(request("{invalid"));
    const oversized = await POST(request(JSON.stringify({ ...validLead, message: "x".repeat(33 * 1024) })));
    const invalidPayload = await POST(request(JSON.stringify({ ...validLead, email: "not-an-email" })));
    const honeypot = await POST(request(JSON.stringify({ ...validLead, website_url: "https://bot.example" })));

    for (const response of [invalidJson, oversized, invalidPayload, honeypot]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: "LEAD_ERROR" });
    }
    expect(mocks.sendLeadOwnerNotification).not.toHaveBeenCalled();
  });

  it("maps the external delivery failure to the documented unavailable response", async () => {
    mocks.sendLeadOwnerNotification.mockResolvedValueOnce({ error: "provider failure", success: false });
    const { POST } = await import("@/app/api/leads/route");

    const response = await POST(request(JSON.stringify(validLead)));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: "LEAD_ERROR" });
  });
});
