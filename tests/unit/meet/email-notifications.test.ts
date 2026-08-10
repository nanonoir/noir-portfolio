import { afterEach, describe, expect, it, vi } from "vitest";

import { createBookingRecord } from "@/lib/meet/booking-model";
import { MockBookingRepository } from "@/lib/meet/booking-repository";
import { EMAIL_TEMPLATE_CODES, type EmailProvider, type EmailProviderResult } from "@/lib/meet/email-provider";
import { sendInitialRequestNotifications } from "@/lib/meet/email-notifications";
import type { IssuedActionToken } from "@/lib/meet/action-tokens";
import { createBookingRequest } from "../../helpers/booking-factory";

function token(): IssuedActionToken {
  return {
    record: {
      action: "confirm",
      actor: "owner",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      id: "token-1",
      meetingId: "meet-1",
      processingOwnerNonce: null,
      processingStartedAt: null,
      proposalVersion: "v1",
      result: null,
      tokenHash: "hash",
      usedAt: null,
    },
    token: "raw-token",
  };
}

function providerWithGate() {
  const starts: string[] = [];
  const releases = new Map<string, () => void>();
  const provider: EmailProvider = {
    send: vi.fn((template): Promise<EmailProviderResult> => new Promise(resolve => {
      starts.push(template);
      releases.set(template, () => resolve({ success: true }));
    })),
    sendMeetingRequested: vi.fn(),
    sendMeetingConfirmed: vi.fn(),
    sendRescheduleProposed: vi.fn(),
  };
  return { provider, releases, starts };
}

describe("initial meeting notifications", () => {
  afterEach(() => {
    delete process.env.CONTACT_TO_EMAIL;
    vi.restoreAllMocks();
  });

  it("starts owner and visitor sends concurrently and writes one aggregate result", async () => {
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    const repository = new MockBookingRepository();
    const booking = createBookingRecord(createBookingRequest(), { id: "meet-1" });
    await repository.create(booking);
    const { provider, releases, starts } = providerWithGate();

    const result = sendInitialRequestNotifications(provider, repository, booking, [token()]);
    await Promise.resolve();
    expect(starts).toEqual(expect.arrayContaining([
      EMAIL_TEMPLATE_CODES.MEETING_REQUESTED,
      EMAIL_TEMPLATE_CODES.MEETING_RECEIVED,
    ]));
    releases.get(EMAIL_TEMPLATE_CODES.MEETING_REQUESTED)?.();
    releases.get(EMAIL_TEMPLATE_CODES.MEETING_RECEIVED)?.();

    await expect(result).resolves.toMatchObject({ record: { emailDelivery: { status: "completed" } } });
  });

  it("does not send an owner email when action links are empty", async () => {
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    const repository = new MockBookingRepository();
    const booking = createBookingRecord(createBookingRequest(), { id: "meet-1" });
    await repository.create(booking);
    const send = vi.fn(async (template: string) => ({ success: true as const, template }));
    const provider = {
      send,
      sendMeetingRequested: vi.fn(),
      sendMeetingConfirmed: vi.fn(),
      sendRescheduleProposed: vi.fn(),
    } as unknown as EmailProvider;

    const result = await sendInitialRequestNotifications(provider, repository, booking, []);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(EMAIL_TEMPLATE_CODES.MEETING_RECEIVED, expect.anything());
    expect(result).toMatchObject({ failureClass: "transient", record: { emailDelivery: { status: "failed" } } });
  });
});
