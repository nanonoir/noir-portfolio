import type { Metadata } from "next";
import { getDictionary, type Language } from "@/lib/i18n";
import { languageAlternates, localeUrl, SEO_ORIGIN } from "@/lib/locale-routing";

export function generatePortfolioMetadata(locale: Language): Metadata {
  const dictionary = getDictionary(locale);
  const title = `${dictionary.meta.siteName} — ${dictionary.meta.role}`;

  return {
    metadataBase: new URL(SEO_ORIGIN),
    title,
    description: dictionary.meta.description,
    authors: [{ name: dictionary.meta.siteName }],
    creator: dictionary.meta.siteName,
    alternates: { canonical: localeUrl(locale), languages: languageAlternates() },
    openGraph: {
      type: "website",
      title,
      description: dictionary.meta.description,
      url: localeUrl(locale),
      siteName: dictionary.meta.siteName,
      locale: locale === "es" ? "es_AR" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_AR"],
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: dictionary.meta.description, images: ["/opengraph-image"] },
  };
}
