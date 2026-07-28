import { afterEach, describe, expect, it, vi } from "vitest";

const isFirebaseConfigured = vi.fn();
const getFirestore = vi.fn();

vi.mock("@/lib/server/env", () => ({ isFirebaseConfigured }));
vi.mock("@/lib/server/firestore", () => ({ getFirestore }));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function queryWith(docs: Array<{ data: () => Record<string, unknown> }>) {
  const get = vi.fn().mockResolvedValue({ docs, size: docs.length });
  const limit = vi.fn(() => ({ get }));
  const where = vi.fn(() => ({ limit }));
  return { get, limit, where };
}

describe("meet health aggregates", () => {
  it("returns only bounded counts for stale leases and retryable failed delivery", async () => {
    isFirebaseConfigured.mockReturnValue(true);
    const actionTokens = queryWith([{ data: () => ({ result: { status: "processing" } }) }, { data: () => ({ result: { status: "completed" } }) }]);
    const webhookNotifications = queryWith([{ data: () => ({ status: "processing" }) }, { data: () => ({ status: "completed" }) }]);
    const calendarDeliveries = queryWith([{}, {}].map(() => ({ data: () => ({}) })));
    const emailDeliveries = queryWith([{}].map(() => ({ data: () => ({}) })));
    const collectionGroup = vi.fn(() => actionTokens);
    const collection = vi.fn((name: string) => name === "calendarWebhookNotifications" ? webhookNotifications : {
      where: vi.fn((field: string) => field === "calendarDelivery.status" ? calendarDeliveries.where() : emailDeliveries.where()),
    });
    getFirestore.mockReturnValue({ collection, collectionGroup });

    const { getMeetHealthAggregates } = await import("@/lib/meet/health-aggregates");
    await expect(getMeetHealthAggregates(new Date("2026-08-03T12:00:00.000Z"))).resolves.toEqual({
      actionTokenLeases: { stale: 1, status: "available" },
      deliveries: { calendarFailed: 2, emailFailed: 1, retryable: 3, status: "available" },
      webhookNotificationLeases: { stale: 1, status: "available" },
    });
    expect(actionTokens.limit).toHaveBeenCalledWith(100);
    expect(webhookNotifications.limit).toHaveBeenCalledWith(100);
  });

  it("fails closed when Firestore is unavailable", async () => {
    isFirebaseConfigured.mockReturnValue(false);
    const { getMeetHealthAggregates } = await import("@/lib/meet/health-aggregates");
    await expect(getMeetHealthAggregates()).resolves.toEqual({
      actionTokenLeases: { stale: null, status: "unavailable" },
      deliveries: { calendarFailed: null, emailFailed: null, retryable: null, status: "unavailable" },
      webhookNotificationLeases: { stale: null, status: "unavailable" },
    });
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("returns unavailable metadata when a bounded aggregate read fails", async () => {
    isFirebaseConfigured.mockReturnValue(true);
    getFirestore.mockReturnValue({
      collection: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockRejectedValue(new Error("offline")) })) })) })),
      collectionGroup: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockRejectedValue(new Error("offline")) })) })) })),
    });
    const { getMeetHealthAggregates } = await import("@/lib/meet/health-aggregates");
    await expect(getMeetHealthAggregates()).resolves.toEqual({
      actionTokenLeases: { stale: null, status: "unavailable" },
      deliveries: { calendarFailed: null, emailFailed: null, retryable: null, status: "unavailable" },
      webhookNotificationLeases: { stale: null, status: "unavailable" },
    });
  });
});
