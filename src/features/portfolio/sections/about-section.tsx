"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/language-provider";
import {
  Button,
  CardSurface,
  Chip,
  HandwrittenIcon,
  PdfModal,
  SectionShell,
} from "@/components/ui";
import type { DocumentConfig } from "@/components/ui/pdf-modal";
import { aboutOrbitTech, assets } from "@/data/content";
import { PortfolioTechnologyIcon } from "./portfolio-technology-icon";

const OUTER_RING = aboutOrbitTech.slice(0, 4);
const INNER_RING = aboutOrbitTech.slice(4);

function AboutDesktopIllustration({ profileAlt }: { profileAlt: string }) {
  const orbitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        el.dataset.orbitVisible = entry.isIntersecting ? "true" : "false";
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="about-orbit relative mx-auto hidden aspect-square w-full max-w-sm lg:block"
      ref={orbitRef}
    >
      <div className="absolute inset-0 rounded-full border border-border/50" />
      <div className="absolute inset-[16%] rounded-full border border-border/50" />
      <div className="absolute inset-[32%] overflow-hidden rounded-full">
        <Image alt={profileAlt} className="h-full w-full object-cover grayscale" height={240} src={assets.profile} width={240} />
      </div>
      <div className="orbit-ring-outer orbit-ring absolute inset-0">
        {OUTER_RING.map((tech, index) => {
          const angle = (index / OUTER_RING.length) * 360;

          return (
            <span
              aria-label={tech.name}
              className="absolute top-1/2 left-1/2"
              key={tech.name}
              role="img"
              style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-50cqmin)` }}
            >
              <span className="orbit-icon-cw block">
                <span className="block" style={{ transform: `rotate(${-angle}deg)` }}>
                  <PortfolioTechnologyIcon className="size-5 text-foreground" name={tech.name} size={20} />
                </span>
              </span>
            </span>
          );
        })}
      </div>
      <div className="orbit-ring-inner orbit-ring absolute inset-[16%]">
        {INNER_RING.map((tech, index) => {
          const angle = (index / INNER_RING.length) * 360;

          return (
            <span aria-label={tech.name} className="absolute top-1/2 left-1/2" key={tech.name} role="img" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-50cqmin)` }}>
              <span className="orbit-icon-ccw block">
                <span className="block" style={{ transform: `rotate(${-angle}deg)` }}>
                  <PortfolioTechnologyIcon className="size-5 text-foreground" name={tech.name} size={20} />
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AboutResponsiveCard({ profileAlt }: { profileAlt: string }) {
  return (
    <div className="about-static lg:hidden">
      <CardSurface className="flex items-center gap-5 py-6 hover:border-border">
        <div className="size-28 shrink-0 overflow-hidden rounded-full border border-border">
          <Image alt={profileAlt} className="h-full w-full object-cover grayscale" height={112} src={assets.profile} width={112} />
        </div>
        <div className="flex flex-1 flex-wrap justify-start gap-2">
          {aboutOrbitTech.map((tech) => (
            <Chip className="gap-1.5" key={tech.name} size="sm">
              <PortfolioTechnologyIcon className="size-3.5 text-foreground" name={tech.name} size={14} />
              {tech.name}
            </Chip>
          ))}
        </div>
      </CardSurface>
    </div>
  );
}

export function AboutSection() {
  const { dictionary, language } = useLanguage();
  const about = dictionary.about;
  const [openDocument, setOpenDocument] = useState<"diploma" | "resume" | null>(null);
  const resumeConfig: DocumentConfig = {
    title: dictionary.modals.resumeTitle,
    hideTitle: true,
    previewSrc: language === "es" ? assets.documentPreviews.resumeEs : assets.documentPreviews.resumeEn,
    downloadHref: assets.resume[language],
    downloadLabel: dictionary.modals.resumeDownloadLabel,
    openLabel: dictionary.modals.resumeOpenLabel,
  };
  const diplomaConfig: DocumentConfig = {
    title: dictionary.modals.diplomaTitle,
    previewSrc: assets.documentPreviews.diploma,
    pdfSrc: assets.diploma,
  };

  return (
    <SectionShell id="about">
      <div className="grid items-start gap-12 lg:grid-cols-[2fr_1fr] lg:gap-16">
        <div>
          <p className="mono mb-4 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{about.label}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-foreground lg:text-[52px] lg:leading-none">{about.title}</h2>
          <div className="mt-8 space-y-4 text-base leading-7 text-body-foreground">
            <h3 className="flex items-center gap-2 text-lg leading-7 font-semibold tracking-[-0.02em] text-foreground">{about.introHeading}</h3>
            {about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <CardSurface className="mt-6 hover:border-border">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface"><HandwrittenIcon className="size-5 shrink-0" icon="education" size={24} /></span>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{about.educationHeading}</h3>
                <p className="mt-3 text-sm leading-6 text-body-foreground">{about.educationInstitution}</p>
                <p className="mono mt-1 text-xs text-muted-foreground">{about.educationDetail}</p>
              </div>
            </div>
          </CardSurface>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button icon={<HandwrittenIcon className="size-4" icon="diploma" />} label={about.diplomaCta} onClick={() => setOpenDocument("diploma")} variant="outlined" />
            <Button icon={<HandwrittenIcon className="size-4" icon="view" />} label={about.resumeCta} onClick={() => setOpenDocument("resume")} variant="outlined" />
          </div>
          <div className="mt-8">
            <p className="mono mb-4 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{about.capabilitiesLabel}</p>
            <div className="flex flex-wrap gap-2">{about.capabilities.map((capability) => <Chip key={capability} size="sm">{capability}</Chip>)}</div>
          </div>
        </div>
        <div className="lg:flex lg:self-center lg:justify-center"><AboutDesktopIllustration profileAlt={about.profileAlt} /><AboutResponsiveCard profileAlt={about.profileAlt} /></div>
      </div>
      <PdfModal closeLabel={dictionary.modals.closeLabel} config={diplomaConfig} isOpen={openDocument === "diploma"} onClose={() => setOpenDocument(null)} />
      <PdfModal closeLabel={dictionary.modals.closeLabel} config={resumeConfig} isOpen={openDocument === "resume"} onClose={() => setOpenDocument(null)} />
    </SectionShell>
  );
}
