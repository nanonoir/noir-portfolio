import type { Metadata } from "next";
import { PortfolioDocument } from "@/components/portfolio-document";
import { generatePortfolioMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePortfolioMetadata("es");

export default function SpanishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PortfolioDocument language="es">{children}</PortfolioDocument>;
}
