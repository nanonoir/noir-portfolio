import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageProvider } from "@/components/providers/language-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { fontVariables } from "@/app/fonts";
import { getDictionary, isLanguage, SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n";
import { languageAlternates, localeUrl, SEO_ORIGIN } from "@/lib/locale-routing";
import "@/app/globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((locale) => ({ locale }));
}

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

async function getLocale(params: LocaleLayoutProps["params"]): Promise<Language> {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = await getLocale(params);
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

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await getLocale(params);

  return (
    <html lang={locale} suppressHydrationWarning className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider initialLanguage={locale}>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
