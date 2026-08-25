import { DEFAULT_LANGUAGE, isLanguage, type Language } from "@/lib/i18n";

export const SEO_ORIGIN = "https://noirnahuel.com";
export const LANGUAGE_COOKIE = "nn-lang";

const ACCEPT_LANGUAGE_PATTERN = /^([a-z]{1,8})(?:-[a-z0-9]{1,8})*(?:\s*;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i;

type LanguagePreference = { language: Language; quality: number; order: number };

function parseAcceptLanguageHeader(header: string | null): LanguagePreference[] {
  if (!header) return [];

  return header
    .split(",")
    .map((part, order) => {
      const match = part.trim().match(ACCEPT_LANGUAGE_PATTERN);
      if (!match) return null;

      const language = match[1].toLowerCase().split("-")[0];
      if (!isLanguage(language)) return null;

      const quality = match[2] === undefined ? 1 : Number(match[2]);
      return { language, quality, order };
    })
    .filter((preference): preference is LanguagePreference => preference !== null && preference.quality > 0)
    .sort((first, second) => second.quality - first.quality || first.order - second.order);
}

export function selectRequestLanguage(cookie: string | undefined, acceptLanguage: string | null): Language {
  if (isLanguage(cookie)) return cookie;
  return parseAcceptLanguageHeader(acceptLanguage)[0]?.language ?? DEFAULT_LANGUAGE;
}

export function localeUrl(locale: Language): URL {
  return new URL(locale === "es" ? "/" : "/en", SEO_ORIGIN);
}

export function languageAlternates(): Record<Language | "x-default", string> {
  return {
    en: localeUrl("en").toString(),
    es: localeUrl("es").toString(),
    "x-default": localeUrl("es").toString(),
  };
}
