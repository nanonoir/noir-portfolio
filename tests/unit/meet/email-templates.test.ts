import { describe, expect, it } from "vitest";
import { composeMeetingEmail, escapeHtml } from "@/lib/meet/email-templates";
import { createBookingRecordFixture } from "../../helpers/booking-factory";

describe("meeting email templates", () => {
  it("escapes untrusted values and keeps owner-only details private", () => {
    const booking = createBookingRecordFixture({ visitorEmail: "<script>@example.com" });
    const owner = composeMeetingEmail({ actionLinks: [{ label: "Confirm", url: "https://example.test/?x=<x>" }], audience: "owner", booking: { ...booking, identity: { ...booking.identity, message: "<script>alert(1)</script>" } }, template: "MEETING_REQUESTED" });
    const visitor = composeMeetingEmail({ audience: "visitor", booking, template: "MEETING_RECEIVED" });
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(owner.html).toContain("&lt;script&gt;");
    expect(owner.html).not.toContain("<script>alert");
    expect(owner.text).toContain("Confirm: https://example.test/?x=<x>");
    expect(visitor.html).not.toContain("Visitor details");
    expect(visitor.text).toContain(visitor.subject);
  });
});
