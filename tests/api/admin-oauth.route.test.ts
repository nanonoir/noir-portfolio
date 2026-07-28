import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  buildAuthUrl: vi.fn(),
  exchangeCodeForRefreshToken: vi.fn(),
  getGoogleOAuthAdminSecret: vi.fn(),
  validatePrimaryCalendarAccess: vi.fn(),
}));

vi.mock("@/lib/server/google-oauth", () => ({
  buildAuthUrl: mocks.buildAuthUrl,
  exchangeCodeForRefreshToken: mocks.exchangeCodeForRefreshToken,
  getGoogleOAuthAdminSecret: mocks.getGoogleOAuthAdminSecret,
  validatePrimaryCalendarAccess: mocks.validatePrimaryCalendarAccess,
}));

const stateCookie = (state: string) => ({ cookie: `google_oauth_state=${state}` });
const expectClearedState = (response: Response) => {
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie).toContain("google_oauth_state=");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Path=/");
  expect(cookie).toContain("Max-Age=0");
};

describe("Google OAuth administrative route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGoogleOAuthAdminSecret.mockReturnValue("test-secret");
    mocks.buildAuthUrl.mockImplementation((state: string) => `https://accounts.example.test/auth?state=${state}`);
    mocks.validatePrimaryCalendarAccess.mockResolvedValue({ calendarId: "primary", ok: true });
  });

  it("rejects missing and wrong authorize secrets from query or header", async () => {
    const { GET } = await import("@/app/api/admin/google-oauth/authorize/route");
    const missing = await GET(new Request("http://localhost/api/admin/google-oauth/authorize"));
    const wrong = await GET(new Request("http://localhost/api/admin/google-oauth/authorize", { headers: { "x-admin-secret": "wrong" } }));

    expect(missing.status).toBe(403);
    expect(await missing.json()).toEqual({ success: false, error: "FORBIDDEN" });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toEqual({ success: false, error: "FORBIDDEN" });
  });

  it("authorizes query and header secrets, binding state to the secure HTTP-only cookie", async () => {
    const { GET } = await import("@/app/api/admin/google-oauth/authorize/route");
    const response = await GET(new Request("http://localhost/api/admin/google-oauth/authorize?admin=test-secret"));

    expect(response.status).toBe(307);
    const state = new URL(response.headers.get("location") ?? "").searchParams.get("state");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(state).toBeTruthy();
    expect(mocks.buildAuthUrl).toHaveBeenCalledWith(state);
    expect(cookie).toContain(`google_oauth_state=${state}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).not.toContain("Secure");
    const headerAuthorized = await GET(new Request("http://localhost/api/admin/google-oauth/authorize", { headers: { "x-admin-secret": "test-secret" } }));
    expect(headerAuthorized.status).toBe(307);
  });

  it("returns the documented configuration error when authorization URL construction fails", async () => {
    mocks.buildAuthUrl.mockImplementationOnce(() => { throw new Error("missing OAuth config"); });
    const { GET } = await import("@/app/api/admin/google-oauth/authorize/route");

    const response = await GET(new Request("http://localhost/api/admin/google-oauth/authorize?admin=test-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "GOOGLE_OAUTH_NOT_CONFIGURED" });
  });

  it("clears state for mismatched state, provider errors, and missing codes without exchange", async () => {
    const { GET } = await import("@/app/api/admin/google-oauth/callback/route");
    const mismatch = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=wrong", { headers: stateCookie("expected") }));
    const providerError = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=expected&error=access_denied", { headers: stateCookie("expected") }));
    const missingCode = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=expected", { headers: stateCookie("expected") }));

    expect(mismatch.status).toBe(403);
    expect(providerError.status).toBe(502);
    expect(await providerError.json()).toMatchObject({ error: "OAUTH_PROVIDER_ERROR", providerError: "access_denied" });
    expect(missingCode.status).toBe(400);
    for (const response of [mismatch, providerError, missingCode]) expectClearedState(response);
    expect(mocks.exchangeCodeForRefreshToken).not.toHaveBeenCalled();
  });

  it("handles missing refresh tokens and returns only the documented OAuth success fields", async () => {
    const { GET } = await import("@/app/api/admin/google-oauth/callback/route");
    mocks.exchangeCodeForRefreshToken.mockResolvedValueOnce({ access_token: "access-token" });
    const noRefresh = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=expected&code=code-1", { headers: stateCookie("expected") }));
    mocks.exchangeCodeForRefreshToken.mockResolvedValueOnce({ refresh_token: "refresh-token-1234", access_token: "access-token-1234" });
    const success = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=expected&code=code-2", { headers: stateCookie("expected") }));

    expect(noRefresh.status).toBe(502);
    expect(await noRefresh.json()).toMatchObject({ error: "NO_REFRESH_TOKEN" });
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({
      success: true,
      refreshToken: "refresh-token-1234",
      refreshTokenMasked: "refres…1234",
      accessTokenMasked: "access…1234",
      calendarId: "primary",
      calendarAccess: "verified",
    });
    expectClearedState(success);
  });

  it("maps exchange exceptions to a cleared, generic provider failure", async () => {
    mocks.exchangeCodeForRefreshToken.mockRejectedValueOnce(new Error("private provider failure"));
    const { GET } = await import("@/app/api/admin/google-oauth/callback/route");

    const response = await GET(new NextRequest("http://localhost/api/admin/google-oauth/callback?state=expected&code=code-3", { headers: stateCookie("expected") }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ success: false, error: "OAUTH_EXCHANGE_FAILED" });
    expectClearedState(response);
  });
});
