import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioDocument } from "@/components/portfolio-document";
import { generatePortfolioMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "en" }];
}

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

async function getLocale(params: LocaleLayoutProps["params"]): Promise<"en"> {
  const { locale } = await params;
  if (locale !== "en") notFound();
  return "en";
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  return generatePortfolioMetadata(await getLocale(params));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await getLocale(params);

  return <PortfolioDocument language={locale}>{children}</PortfolioDocument>;
}
