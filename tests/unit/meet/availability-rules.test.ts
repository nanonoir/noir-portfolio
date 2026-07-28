import { describe, expect, it } from "vitest";
import { MockAvailabilityRepository } from "@/lib/meet/availability-repository";
import { getValidStartTimes, isDateWithinBusinessRules, isValidZonedDateTime, resolveTimezone } from "@/lib/meet/availability-rules";

describe("availability rules", () => {
  const now = new Date("2026-08-03T08:00:00.000Z");
  it("uses timezone fallback and exact hourly starts", () => {
    expect(resolveTimezone("UTC", "America/New_York").timezone).toBe("UTC");
    expect(resolveTimezone("bad", "UTC")).toMatchObject({ timezone: "UTC", usedFallback: true });
    expect(getValidStartTimes("2026-08-04", "UTC" as never, now).map(({ time }) => time)).toEqual(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]);
  });
  it("rejects invalid dates, lead windows, and DST gaps", () => {
    expect(isDateWithinBusinessRules("2026-08-02", "UTC" as never, now)).toBe(false);
    expect(isDateWithinBusinessRules("2026-09-03", "UTC" as never, now)).toBe(false);
    expect(getValidStartTimes("2026-08-03", "UTC" as never, now)).toHaveLength(0);
    expect(isValidZonedDateTime("2026-03-08", "02:00", "America/New_York" as never)).toBe(false);
  });

  it("keeps the mock fallback deterministic while consuming the shared candidate rules", async () => {
    const repository = new MockAvailabilityRepository(() => now);
    const candidates = getValidStartTimes("2026-08-04", "UTC" as never, now).map(({ time }) => time);

    const first = await repository.getSlots({ date: "2026-08-04", timezone: "UTC" as never });
    const second = await repository.getSlots({ date: "2026-08-04", timezone: "UTC" as never });

    expect(first).toEqual(second);
    expect(first).toHaveLength(8);
    expect(first.every(({ time }) => candidates.includes(time))).toBe(true);
  });
});
