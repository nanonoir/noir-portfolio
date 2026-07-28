import { describe, expect, it } from "vitest";
import { buildMeetingPayload } from "@/components/forms/meeting-payload-mapper";

describe("meeting payload context", () => {
  it("maps service context with normalized identity and service details", () => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language: "en-US" } });
    const payload = buildMeetingPayload({ idempotencyKey: "00000000-0000-4000-8000-000000000001", language: "en", origin: "service", previousValues: { brandName: " Noir ", email: " VISITOR@EXAMPLE.COM ", message: "hello", name: " Visitor ", projectType: "business", phone: "+15555550100", social: "" } as never, service: { description: { en: "", es: "" }, features: [], id: "landing", title: { en: "", es: "" } }, values: { date: "2026-08-04", message: "", time: "10:00" } });
    expect(payload).toMatchObject({ origin: "service", relatedService: "landing", identity: { email: "visitor@example.com", name: "Visitor" }, previousRequest: { service: "landing", details: { brandName: "Noir", projectType: "business" } } });
  });
  it("rejects service requests without context", () => {
    expect(() => buildMeetingPayload({ idempotencyKey: "00000000-0000-4000-8000-000000000001", language: "en", origin: "service", values: { date: "2026-08-04", message: "", time: "10:00" } })).toThrow("context is missing");
  });
});
