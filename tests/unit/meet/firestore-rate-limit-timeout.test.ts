import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
}));

vi.mock("@/lib/server/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({ doc: vi.fn(() => ({})) })),
    runTransaction: mocks.runTransaction,
  })),
}));

describe("Firestore rate limit timeout boundary", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects a hanging transaction at the configured timeout", async () => {
    vi.useFakeTimers();
    mocks.runTransaction.mockImplementation(() => new Promise(() => undefined));
    const { consumeFirestoreFixedWindow } = await import("@/lib/meet/firestore-rate-limit");

    const result = consumeFirestoreFixedWindow("visitor", 10, 60_000, 25);
    const expectation = expect(result).rejects.toMatchObject({ code: "TIMEOUT", name: "BoundedTimeoutError" });
    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });
});
