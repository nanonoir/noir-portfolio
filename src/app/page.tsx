import { PortfolioNavigation } from "@/components/layout/portfolio-navigation";
import { Hero } from "@/components/sections/hero";
import { ProjectsSection } from "@/components/sections/projects-section";
import { StaticSections } from "@/components/sections/static-sections";

export default function Home() {
  return (
    <>
      <PortfolioNavigation />
      <Hero />
      <ProjectsSection />
      <StaticSections />
    </>
  );
}
