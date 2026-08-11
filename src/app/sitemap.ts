import type { MetadataRoute } from "next";
import { languageAlternates, localeUrl } from "@/lib/locale-routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const alternates = languageAlternates();
  return ["en", "es"].map((locale) => ({
    url: localeUrl(locale as "en" | "es").toString(),
    alternates: { languages: alternates },
  }));
}
