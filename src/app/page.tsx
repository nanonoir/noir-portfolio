import { AboutSection } from "@/features/portfolio/sections/about-section";
import { ContactSection } from "@/features/portfolio/sections/contact-section";
import { PortfolioFooter } from "@/features/portfolio/sections/footer-section";
import { Hero } from "@/features/portfolio/sections/hero";
import { ProjectsSection } from "@/features/portfolio/sections/projects-section";
import { ServicesSection } from "@/features/portfolio/sections/services-section";
import { StackSection } from "@/features/portfolio/sections/stack-section";
import { PortfolioNavigation } from "@/features/portfolio/navigation/portfolio-navigation";

export default function Home() {
  return (
    <>
      <PortfolioNavigation />
      <Hero />
      <ProjectsSection />
      <AboutSection />
      <ServicesSection />
      <StackSection />
      <ContactSection />
      <PortfolioFooter />
    </>
  );
}
