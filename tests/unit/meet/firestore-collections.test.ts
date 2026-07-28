import { describe, expect, it } from "vitest";

import { reservedSlotDoc } from "@/lib/meet/firestore-collections";

describe("Firestore collection paths", () => {
  it("uses the supplied slot identity in a reserved-slot document path", () => {
    expect(reservedSlotDoc("2026-08-04T10:00:00.000Z")).toBe(
      "reservedSlots/2026-08-04T10:00:00.000Z",
    );
  });
});
