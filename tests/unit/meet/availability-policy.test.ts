import { describe, expect, it } from "vitest";
import type { Timezone } from "@/lib/meet/domain";
import {
  getValidStartTimes as getServerValidStartTimes,
} from "@/lib/meet/availability-rules";
import {
  getValidStartTimes,
  isDateWithinBusinessRules,
  isValidTimeZone,
  isValidZonedDateTime,
} from "@/lib/meet/availability-policy";

const utc = "UTC" as Timezone;
const newYork = "America/New_York" as Timezone;
const now = new Date("2026-08-03T08:00:00.000Z");

describe("availability policy", () => {
  it("generates normal business-day candidates", () => {
    const candidates = getValidStartTimes("2026-08-04", utc, now);

    expect(candidates.map(({ time }) => time)).toEqual([
      "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
      "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
    ]);
    expect(candidates[0]).toEqual({
      time: "08:00",
      startISO: "2026-08-04T08:00:00.000Z",
      endISO: "2026-08-04T08:30:00.000Z",
    });
  });

  it("rejects invalid calendar dates and timezones", () => {
    expect(isDateWithinBusinessRules("2026-02-30", utc, now)).toBe(false);
    expect(isValidTimeZone("Invalid/Zone")).toBe(false);
    expect(getValidStartTimes("2026-08-04", "Invalid/Zone", now)).toEqual([]);
  });

  it("enforces the 12-hour minimum lead time", () => {
    expect(getValidStartTimes("2026-08-03", utc, new Date("2026-08-02T20:01:00.000Z"))[0]?.time).toBe("09:00");
    expect(getValidStartTimes("2026-08-03", utc, new Date("2026-08-02T20:00:00.000Z"))[0]?.time).toBe("08:00");
  });

  it("allows Monday through Saturday within the inclusive 30-day horizon", () => {
    expect(isDateWithinBusinessRules("2026-08-08", utc, now)).toBe(true);
    expect(isDateWithinBusinessRules("2026-08-09", utc, now)).toBe(false);
    expect(isDateWithinBusinessRules("2026-09-02", utc, now)).toBe(true);
    expect(isDateWithinBusinessRules("2026-09-03", utc, now)).toBe(false);
  });

  it("rejects nonexistent spring-forward wall-clock times", () => {
    expect(isValidZonedDateTime("2026-03-08", "02:00", newYork)).toBe(false);
  });

  it("rejects ambiguous fall-back wall-clock times", () => {
    expect(isValidZonedDateTime("2026-11-01", "01:00", newYork)).toBe(false);
  });

  it("keeps client-safe policy candidates equivalent to the server facade", () => {
    for (const [date, timezone] of [["2026-08-04", utc], ["2026-11-02", newYork]] as const) {
      expect(getValidStartTimes(date, timezone, now)).toEqual(getServerValidStartTimes(date, timezone, now));
    }
  });
});
