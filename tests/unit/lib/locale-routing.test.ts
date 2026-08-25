import { describe, expect, it } from "vitest";

import {
  LANGUAGE_COOKIE,
  SEO_ORIGIN,
  languageAlternates,
  localeUrl,
  selectRequestLanguage,
} from "@/lib/locale-routing";

describe("locale routing", () => {
  it("prioritizes a valid cookie over browser preferences", () => {
    expect(selectRequestLanguage("es", "en-US,en;q=0.9")).toBe("es");
  });

  it("orders supported browser languages by quality", () => {
    expect(selectRequestLanguage(undefined, "fr-FR;q=1,es-AR;q=0.8,en;q=0.6")).toBe("es");
  });

  it("ignores malformed, unsupported, and zero-quality ranges", () => {
    expect(selectRequestLanguage("fr", "fr-FR;q=bad,es;q=0,en-US;q=0.7")).toBe("en");
  });

  it("falls back to English when no supported preference exists", () => {
    expect(selectRequestLanguage(undefined, "de-DE,de;q=0.9")).toBe("en");
    expect(selectRequestLanguage(undefined, null)).toBe("en");
  });

  it("builds immutable production URLs and reciprocal alternates", () => {
    expect(LANGUAGE_COOKIE).toBe("nn-lang");
    expect(localeUrl("es").toString()).toBe(`${SEO_ORIGIN}/`);
    expect(languageAlternates()).toEqual({
      en: `${SEO_ORIGIN}/en`,
      es: `${SEO_ORIGIN}/`,
      "x-default": `${SEO_ORIGIN}/`,
    });
  });
});
