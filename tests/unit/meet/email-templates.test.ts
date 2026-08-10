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

  it("escapes a decline reason and omits empty notes", () => {
    const booking = createBookingRecordFixture();
    const declined = composeMeetingEmail({
      audience: "visitor",
      booking,
      note: "<script>alert(1)</script>",
      template: "MEETING_DECLINED",
    });
    const empty = composeMeetingEmail({ audience: "visitor", booking, note: "   ", template: "MEETING_DECLINED" });

    expect(declined.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(declined.html).not.toContain("<script>alert(1)</script>");
    expect(empty.html).not.toContain("alert");
  });

  it("renders persisted visitor details for owner confirmation without action links", () => {
    const booking = createBookingRecordFixture();
    const owner = composeMeetingEmail({ audience: "owner", booking, template: "MEETING_CONFIRMED" });

    expect(owner.html).toContain("Visitor details");
    expect(owner.html).toContain(booking.identity.name);
    expect(owner.html).not.toContain("Actions");
  });
});
