"use client";

import { AboutSection } from "@/features/portfolio/sections/about-section";
import { ContactSection } from "@/features/portfolio/sections/contact-section";
import { PortfolioFooter } from "@/features/portfolio/sections/footer-section";
import { ServicesSection } from "@/features/portfolio/sections/services-section";
import { StackSection } from "@/features/portfolio/sections/stack-section";

export function StaticSections() {
  return (
    <>
      <AboutSection />
      <ServicesSection />
      <StackSection />
      <ContactSection />
      <PortfolioFooter />
    </>
  );
}
