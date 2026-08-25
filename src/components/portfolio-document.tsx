import type { ReactNode } from "react";
import { fontVariables } from "@/app/fonts";
import { LanguageProvider } from "@/components/providers/language-provider";
import { PersonWebSiteJsonLd } from "@/components/seo/json-ld";
import { ThemeProvider } from "@/components/providers/theme-provider";
import type { Language } from "@/lib/i18n";
import "@/app/globals.css";

type PortfolioDocumentProps = {
  children: ReactNode;
  language: Language;
};

export function PortfolioDocument({ children, language }: PortfolioDocumentProps) {
  return (
    <html lang={language} suppressHydrationWarning className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider initialLanguage={language}>{children}</LanguageProvider>
          <PersonWebSiteJsonLd />
        </ThemeProvider>
      </body>
    </html>
  );
}
