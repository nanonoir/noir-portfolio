import { describe, expect, it } from "vitest";
import { composeLeadEmail } from "@/lib/leads/email-templates";
import type { LeadRecord } from "@/lib/leads/lead-model";

describe("lead email templates", () => {
  it("escapes visitor content and localizes service labels", () => {
    const lead: LeadRecord = { automationType: "", brandName: "<script>x</script>", budget: "", business: "", email: "visitor@example.com", idempotencyKey: "00000000-0000-4000-8000-000000000001", locale: "es", message: "<img src=x>", name: "Visitor", phone: "+15555550100", projectType: "", service: "landing", social: "", submittedAt: "2026-08-03T12:00:00.000Z", type: "service_request", websiteUrl: "" };
    const email = composeLeadEmail(lead);
    expect(email.subject).toBe("Nueva solicitud de servicio");
    expect(email.html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(email.html).not.toContain("<img src=x>");
    expect(email.text).toContain("Landing / Web Institucional");
  });
});
