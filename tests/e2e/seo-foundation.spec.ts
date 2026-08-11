import { expect, test } from "@playwright/test";

test.describe("SEO foundation", () => {
  test("selects locales at the root and preserves direct locale URLs", async ({ request }) => {
    const spanish = await request.get("/", {
      headers: { "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
      maxRedirects: 0,
    });
    expect(spanish.status()).toBe(307);
    expect(spanish.headers().location).toBe("/es");

    const cookie = await request.get("/", {
      headers: { Cookie: "nn-lang=es", "Accept-Language": "en-US,en;q=0.9" },
      maxRedirects: 0,
    });
    expect(cookie.status()).toBe(307);
    expect(cookie.headers().location).toBe("/es");

    for (const locale of ["en", "es"]) {
      const response = await request.get(`/${locale}`);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain(`<html lang="${locale}"`);
    }
  });

  test("publishes reciprocal metadata and excludes private routes", async ({ request }) => {
    const english = await request.get("/en");
    const html = await english.text();
    expect(html).toContain('rel="canonical" href="https://noirnahuel.com/en"');
    expect(html).toContain('hrefLang="es" href="https://noirnahuel.com/es"');
    expect(html).toContain('hrefLang="x-default" href="https://noirnahuel.com"');
    expect(html).toContain("og:image");

    const robots = await request.get("/robots.txt");
    const robotsText = await robots.text();
    expect(robots.status()).toBe(200);
    expect(robotsText).toContain("Disallow: /api");
    expect(robotsText).toContain("Disallow: /meetings");
    expect(robotsText).toContain("https://noirnahuel.com/sitemap.xml");

    const sitemap = await request.get("/sitemap.xml");
    const sitemapText = await sitemap.text();
    expect(sitemap.status()).toBe(200);
    expect(sitemapText).toContain("https://noirnahuel.com/en");
    expect(sitemapText).toContain("https://noirnahuel.com/es");
    expect(sitemapText).not.toContain("/api/");
    expect(sitemapText).not.toContain("/meetings/");
  });

  test("rejects unsupported locales and preserves unlocalized endpoints", async ({ request }) => {
    const invalid = await request.get("/fr");
    expect(invalid.status()).toBe(404);

    const health = await request.get("/api/health", { maxRedirects: 0 });
    expect(health.status()).toBe(200);
    expect(health.headers().location).toBeUndefined();

    const meeting = await request.get("/meetings/test/propose", { maxRedirects: 0 });
    expect(meeting.status()).toBe(200);
    expect(meeting.headers().location).toBeUndefined();
  });

  test("switches locale through the language control", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const control = page.getByRole("button", { name: /spanish|español/i }).first();
    await expect(control).toBeVisible();
    await control.click();
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
