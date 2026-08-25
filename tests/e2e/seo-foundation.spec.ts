import { expect, test } from "@playwright/test";

function locationPath(location: string | undefined) {
  expect(location).toBeDefined();
  return new URL(location!, "http://localhost");
}

function parseJsonLd(html: string) {
  const scripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
  expect(scripts).toHaveLength(1);
  const firstScript = scripts[0];
  expect(firstScript).toBeDefined();
  const content = firstScript!.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  expect(content).toBeDefined();
  return JSON.parse(content!);
}

function linkHref(html: string, rel: string, hrefLang?: string) {
  const tag = (html.match(/<link\b[^>]*>/g) ?? []).find((candidate) => (
    candidate.includes(`rel="${rel}"`) && (!hrefLang || candidate.includes(`hrefLang="${hrefLang}"`))
  ));
  expect(tag).toBeDefined();
  const href = tag!.match(/\bhref="([^"]+)"/)?.[1];
  expect(href).toBeDefined();
  return href!;
}

function metadataContent(html: string, property: string) {
  const tag = (html.match(/<meta\b[^>]*>/g) ?? []).find((candidate) => candidate.includes(`property="${property}"`));
  expect(tag).toBeDefined();
  const content = tag!.match(/\bcontent="([^"]+)"/)?.[1];
  expect(content).toBeDefined();
  return content!;
}

function expectCanonicalUrl(url: string, pathname: string) {
  const parsed = new URL(url);
  expect(parsed.origin).toBe("https://noirnahuel.com");
  expect(parsed.pathname).toBe(pathname);
  expect(parsed.search).toBe("");
  expect(parsed.hash).toBe("");
}

test.describe("SEO foundation", () => {
  test("serves the Spanish root regardless of language preferences", async ({ request }) => {
    const spanish = await request.get("/", {
      headers: { "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
      maxRedirects: 0,
    });
    expect(spanish.status()).toBe(200);
    expect(spanish.headers().location).toBeUndefined();
    expect(await spanish.text()).toContain('<html lang="es"');

    const cookie = await request.get("/", {
      headers: { Cookie: "nn-lang=es", "Accept-Language": "en-US,en;q=0.9" },
      maxRedirects: 0,
    });
    expect(cookie.status()).toBe(200);
    expect(cookie.headers().location).toBeUndefined();
    expect(await cookie.text()).toContain('<html lang="es"');

    const english = await request.get("/en");
    expect(english.status()).toBe(200);
    expect(await english.text()).toContain('<html lang="en"');
  });

  test("normalizes legacy and trailing-slash locale URLs without dropping queries", async ({ request }) => {
    for (const path of ["/es?ref=foo&source=bar", "/es/?ref=foo&source=bar"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      const location = locationPath(response.headers().location);
      expect(location.pathname).toBe("/");
      expect(location.search).toBe("?ref=foo&source=bar");
    }

    const english = await request.get("/en/?ref=foo", { maxRedirects: 0 });
    expect([301, 308]).toContain(english.status());
    const location = locationPath(english.headers().location);
    expect(location.pathname).toBe("/en");
    expect(location.search).toBe("?ref=foo");
  });

  test("publishes reciprocal metadata and one entity graph on both canonical pages", async ({ request }) => {
    for (const [path, locale, canonicalPath] of [
      ["/", "es", "/"],
      ["/en", "en", "/en"],
    ] as const) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expectCanonicalUrl(linkHref(html, "canonical"), canonicalPath);
      expectCanonicalUrl(linkHref(html, "alternate", "en"), "/en");
      expectCanonicalUrl(linkHref(html, "alternate", "es"), "/");
      expectCanonicalUrl(linkHref(html, "alternate", "x-default"), "/");
      expectCanonicalUrl(metadataContent(html, "og:url"), canonicalPath);
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain("og:image");

      const graph = parseJsonLd(html);
      expect(graph["@context"]).toBe("https://schema.org");
      expect(graph["@graph"]).toHaveLength(2);
      expect(graph["@graph"].filter((entity: { "@type": string }) => entity["@type"] === "Person")).toHaveLength(1);
      expect(graph["@graph"].filter((entity: { "@type": string }) => entity["@type"] === "WebSite")).toHaveLength(1);
      expect(graph["@graph"][0]).toMatchObject({
        "@id": "https://noirnahuel.com/#person",
        jobTitle: "Full-Stack Developer",
        url: "https://noirnahuel.com/",
      });
      expect(graph["@graph"][1]).toMatchObject({
        "@id": "https://noirnahuel.com/#website",
        publisher: { "@id": "https://noirnahuel.com/#person" },
      });
    }

    const robots = await request.get("/robots.txt");
    const robotsText = await robots.text();
    expect(robots.status()).toBe(200);
    expect(robotsText).toContain("Allow: /");
    expect(robotsText).toContain("Allow: /en");
    expect(robotsText).toContain("Allow: /es");
    expect(robotsText).toContain("Disallow: /api");
    expect(robotsText).toContain("Disallow: /meetings");
    expect(robotsText).toContain("https://noirnahuel.com/sitemap.xml");

    const sitemap = await request.get("/sitemap.xml");
    const sitemapText = await sitemap.text();
    expect(sitemap.status()).toBe(200);
    expect(sitemapText).toContain("https://noirnahuel.com/");
    expect(sitemapText).toContain("https://noirnahuel.com/en");
    expect(sitemapText).not.toContain("https://noirnahuel.com/es");
    expect(sitemapText).not.toContain("/api/");
    expect(sitemapText).not.toContain("/meetings/");
  });

  test("preserves semantic and private-route protections", async ({ request }) => {
    for (const [path, headline, liveLabel] of [
      ["/", "Construyendo productos digitales desde la idea hasta producción.", "Ver sitio"],
      ["/en", "Building digital products from idea to production.", "View live"],
    ] as const) {
      const response = await request.get(path);
      const html = await response.text();
      expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
      expect(html).toContain(`aria-label="${headline}"`);
      expect(html.match(/<h3(?:\s|>)/g)?.length).toBeGreaterThan(0);
      expect(html).toContain(`>${liveLabel}<`);
      expect(html).toMatch(/<img\b[^>]*alt="[^"]+"/);
      expect(html).toMatch(/<video\b[^>]*aria-label="[^"]+"/);
    }

    const invalid = await request.get("/fr");
    expect(invalid.status()).toBe(404);

    const descendant = await request.get("/en/unknown", { maxRedirects: 0 });
    expect(descendant.status()).toBe(404);

    const health = await request.get("/api/health", { maxRedirects: 0 });
    expect(health.status()).toBe(200);
    expect(health.headers().location).toBeUndefined();
    expect(health.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");

    const meeting = await request.get("/meetings/test/propose", { maxRedirects: 0 });
    expect(meeting.status()).toBe(200);
    expect(meeting.headers().location).toBeUndefined();
    expect(await meeting.text()).toContain('name="robots" content="noindex, nofollow"');
  });

  test("switches between root Spanish and English while preserving query and hash", async ({ page }) => {
    await page.goto("/?ref=portfolio#projects", { waitUntil: "domcontentloaded" });
    const englishControl = page.getByRole("button", { name: /english|inglés/i }).first();
    await expect(englishControl).toBeVisible();
    await englishControl.click();
    await expect(page).toHaveURL(/\/en\?ref=portfolio#projects$/);

    const control = page.getByRole("button", { name: /spanish|español/i }).first();
    await expect(control).toBeVisible();
    await control.click();
    await expect(page).toHaveURL(/\/\?ref=portfolio#projects$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
