import type { MetadataRoute } from "next";
import { languageAlternates, localeUrl } from "@/lib/locale-routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const alternates = languageAlternates();
  return (["es", "en"] as const).map((locale) => ({
    url: localeUrl(locale).toString(),
    alternates: { languages: alternates },
  }));
}
