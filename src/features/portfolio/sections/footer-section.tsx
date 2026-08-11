"use client";

import { useLanguage } from "@/components/providers/language-provider";

export function PortfolioFooter() {
  const { dictionary } = useLanguage();
  const footer = dictionary.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="hairline-t px-6 pt-10 pb-12">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3 md:items-start">
        <div>
          <p className="font-medium text-foreground">{footer.name}</p>
          <p className="mono mt-2 text-xs text-muted-foreground">{footer.role}</p>
          <p className="mono mt-2 text-xs text-muted-foreground">{footer.stack}</p>
        </div>
        <div aria-hidden="true" />
        <p className="text-sm text-muted-foreground md:text-right">{footer.copyrightPrefix} {year} {footer.name}</p>
      </div>
    </footer>
  );
}
