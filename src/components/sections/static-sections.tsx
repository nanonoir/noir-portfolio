"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { IconType } from "react-icons";
import { DiCode, DiTerminal } from "react-icons/di";
import { FaSlack } from "react-icons/fa6";
import {
  SiClaudecode,
  SiAstro,
  SiCss,
  SiDocker,
  SiExpress,
  SiGit,
  SiGithub,
  SiHtml5,
  SiJavascript,
  SiJira,
  SiLinux,
  SiModelcontextprotocol,
  SiMongodb,
  SiMysql,
  SiN8N,
  SiNestjs,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiNotion,
  SiOpencode,
  SiPostgresql,
  SiPostman,
  SiPrisma,
  SiRailway,
  SiReact,
  SiSequelize,
  SiTailwindcss,
  SiTrello,
  SiTypescript,
  SiVercel,
  SiVuedotjs,
} from "react-icons/si";
import { generalContactFormSchema, type GeneralContactFormValues } from "@/components/forms/schemas";
import { createCustomServiceRequestTarget, type ServiceRequestTarget } from "@/components/forms/service-request-modal";
import { useLanguage } from "@/components/providers/language-provider";
import { assets, aboutOrbitTech, contactLinks, services, stackCategories, type Service } from "@/data/content";
import { Button, CardSurface, Chip, FormError, HandwrittenIcon, Input, Label, PdfModal, SectionHeading, SectionShell, ServiceInfoModal, Textarea, Toast } from "@/components/ui";
import type { DocumentConfig } from "@/components/ui/pdf-modal";

// Dynamically import heavy form modals to exclude them from the initial bundle.
// Preloading is triggered on button hover/focus so first-click latency is ~0ms.
const MeetingModal = dynamic(() => import("@/components/forms/meeting-modal").then((m) => ({ default: m.MeetingModal })), { ssr: false });
const ServiceRequestModal = dynamic(
  () => import("@/components/forms/service-request-modal").then((m) => ({ default: m.ServiceRequestModal })),
  { ssr: false },
);

function preloadMeetingModal() {
  void import("@/components/forms/meeting-modal");
}

function preloadServiceRequestModal() {
  void import("@/components/forms/service-request-modal");
}

// Outer orbit ring: 7 icons, clockwise rotation.
// Each icon counter-rotates so it stays upright.
const OUTER_RING = aboutOrbitTech.slice(0, 4);
// Inner orbit ring: remaining icons, counter-clockwise.
const INNER_RING = aboutOrbitTech.slice(4);

const SERVICE_ICON_BY_ID = {
  automation: "automation",
  ecommerce: "store",
  landing: "landing",
  "web-audit": "audit",
} as const;

const TECHNOLOGY_ICON_BY_NAME: Record<string, IconType> = {
  Astro: SiAstro,
  "CI/CD": DiCode,
  "Claude Code": SiClaudecode,
  CSS: SiCss,
  Docker: SiDocker,
  Express: SiExpress,
  Git: SiGit,
  GitHub: SiGithub,
  HTML: SiHtml5,
  JavaScript: SiJavascript,
  Jira: SiJira,
  JWT: DiCode,
  Linux: SiLinux,
  MCP: SiModelcontextprotocol,
  MongoDB: SiMongodb,
  MySQL: SiMysql,
  n8n: SiN8N,
  NestJS: SiNestjs,
  "Next.js": SiNextdotjs,
  Nginx: SiNginx,
  "Node.js": SiNodedotjs,
  Notion: SiNotion,
  OpenCode: SiOpencode,
  PostgreSQL: SiPostgresql,
  Postman: SiPostman,
  Prisma: SiPrisma,
  Railway: SiRailway,
  React: SiReact,
  "React Native": SiReact,
  "REST APIs": DiCode,
  Sequelize: SiSequelize,
  Slack: FaSlack,
  TailwindCSS: SiTailwindcss,
  Trello: SiTrello,
  TypeScript: SiTypescript,
  Vercel: SiVercel,
  "Vue.js": SiVuedotjs,
  VPS: DiTerminal,
  Webhooks: DiCode,
};

const TECHNOLOGY_COLOR_BY_NAME: Record<string, string> = {
  Astro: "#BC52EE",
  "CI/CD": "#10B981",
  "Claude Code": "#D97757",
  CSS: "#1572B6",
  Docker: "#2496ED",
  Express: "currentColor",
  Git: "#F05032",
  GitHub: "currentColor",
  HTML: "#E34F26",
  JavaScript: "#F7DF1E",
  Jira: "#0052CC",
  JWT: "#8B5CF6",
  Linux: "#FCC624",
  MCP: "#8B5CF6",
  MongoDB: "#47A248",
  MySQL: "#4479A1",
  n8n: "#EA4B71",
  NestJS: "#E0234E",
  "Next.js": "currentColor",
  Nginx: "#009639",
  "Node.js": "#5FA04E",
  Notion: "currentColor",
  OpenCode: "currentColor",
  PostgreSQL: "#4169E1",
  Postman: "#FF6C37",
  Prisma: "#2D3748",
  Railway: "currentColor",
  React: "#61DAFB",
  "React Native": "#61DAFB",
  "REST APIs": "#10B981",
  Sequelize: "#52B0E7",
  Slack: "#4A154B",
  TailwindCSS: "#06B6D4",
  Trello: "#0052CC",
  TypeScript: "#3178C6",
  Vercel: "currentColor",
  "Vue.js": "#4FC08D",
  VPS: "#8B5CF6",
  Webhooks: "#10B981",
};

function TechnologyIcon({ className, name, size }: { className?: string; name: string; size: number }) {
  const IconComponent = TECHNOLOGY_ICON_BY_NAME[name] ?? DiCode;

  return <IconComponent aria-hidden="true" className={className} focusable="false" size={size} style={{ color: TECHNOLOGY_COLOR_BY_NAME[name] ?? "currentColor" }} />;
}

function translateFormError(dictionary: ReturnType<typeof useLanguage>["dictionary"], message?: string) {
  if (!message) {
    return undefined;
  }

  const key = message.replace("forms.errors.", "") as keyof typeof dictionary.forms.errors;
  return dictionary.forms.errors[key] ?? message;
}

function AboutDesktopIllustration({ profileAlt }: { profileAlt: string }) {
  const orbitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;

    // Pause CSS orbit animations when the section is outside the viewport.
    // Uses IntersectionObserver + animation-play-state to avoid per-scroll
    // React state updates. The about-orbit is already display:none under
    // prefers-reduced-motion, so no extra guard is needed here.
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
    // Compact column: max-w-sm keeps it from being too large on lg
    <div className="about-orbit relative mx-auto hidden aspect-square w-full max-w-sm lg:block" ref={orbitRef}>
      {/* Outer ring track */}
      <div className="absolute inset-0 rounded-full border border-border/50" />
      {/* Inner ring track */}
      <div className="absolute inset-[16%] rounded-full border border-border/50" />

      {/* Profile image — grayscale, centered */}
      <div className="absolute inset-[32%] overflow-hidden rounded-full">
        <Image
          alt={profileAlt}
          className="h-full w-full object-cover grayscale"
          height={240}
          src={assets.profile}
          width={240}
        />
      </div>

      {/* Outer orbit ring — rotates clockwise */}
      {/* container-type:size lets translateY(-50cqmin) reach the ring radius */}
      <div className="orbit-ring-outer orbit-ring absolute inset-0">
        {OUTER_RING.map((tech, index) => {
          const angle = (index / OUTER_RING.length) * 360;
          return (
            // Wrapper span: positioned at center, rotated to angle, then pushed out to ring radius
            <span
              aria-label={tech.name}
              className="absolute top-1/2 left-1/2"
              key={tech.name}
              role="img"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-50cqmin)`,
              }}
            >
              {/* Animation span cancels ring rotation; inner span cancels the static placement angle. */}
              <span className="orbit-icon-cw block">
                <span className="block" style={{ transform: `rotate(${-angle}deg)` }}>
                  <TechnologyIcon className="size-5 text-foreground" name={tech.name} size={20} />
                </span>
              </span>
            </span>
          );
        })}
      </div>

      {/* Inner orbit ring — rotates counter-clockwise */}
      <div className="orbit-ring-inner orbit-ring absolute inset-[16%]">
        {INNER_RING.map((tech, index) => {
          const angle = (index / INNER_RING.length) * 360;
          return (
            <span
              aria-label={tech.name}
              className="absolute top-1/2 left-1/2"
              key={tech.name}
              role="img"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-50cqmin)`,
              }}
            >
              <span className="orbit-icon-ccw block">
                <span className="block" style={{ transform: `rotate(${-angle}deg)` }}>
                  <TechnologyIcon className="size-5 text-foreground" name={tech.name} size={20} />
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Responsive card shown on tablet/mobile (hidden on lg+)
function AboutResponsiveCard({ profileAlt }: { profileAlt: string }) {
  return (
    <div className="about-static lg:hidden">
      <CardSurface className="flex items-center gap-5 py-6 hover:border-border">
        {/* Circular B&W profile */}
        <div className="size-28 shrink-0 overflow-hidden rounded-full border border-border">
          <Image
            alt={profileAlt}
            className="h-full w-full object-cover grayscale"
            height={112}
            src={assets.profile}
            width={112}
          />
        </div>
        {/* Tech badges — right side of the responsive reference card */}
        <div className="flex flex-1 flex-wrap justify-start gap-2">
          {aboutOrbitTech.map((tech) => (
            <Chip className="gap-1.5" key={tech.name} size="sm">
              <TechnologyIcon className="size-3.5 text-foreground" name={tech.name} size={14} />
              {tech.name}
            </Chip>
          ))}
        </div>
      </CardSurface>
    </div>
  );
}

function AboutSection() {
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
    // pdfSrc powers the iframe preview on desktop; no downloadHref means
    // no Download or Open-in-new-tab actions are rendered in the header.
    pdfSrc: assets.diploma,
  };

  return (
    <SectionShell id="about">
      {/* 2/3 + 1/3 compact desktop layout */}
      <div className="grid items-start gap-12 lg:grid-cols-[2fr_1fr] lg:gap-16">
        <div>
          <p className="mono mb-4 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{about.label}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-foreground lg:text-[52px] lg:leading-none">
            {about.title}
          </h2>

          {/* Intro at 18px / text-lg — tighter spacing */}
          <div className="mt-8 space-y-4 text-base leading-7 text-body-foreground">
            <h3 className="flex items-center gap-2 text-lg leading-7 font-semibold tracking-[-0.02em] text-foreground">
              {about.introHeading}
            </h3>
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <CardSurface className="mt-6 hover:border-border">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface">
                 <HandwrittenIcon className="size-5 shrink-0" icon="education" size={24} />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{about.educationHeading}</h3>
                <p className="mt-3 text-sm leading-6 text-body-foreground">{about.educationInstitution}</p>
                <p className="mono mt-1 text-xs text-muted-foreground">{about.educationDetail}</p>
              </div>
            </div>
          </CardSurface>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              icon={
                <HandwrittenIcon className="size-4" icon="diploma" />
              }
              label={about.diplomaCta}
              onClick={() => setOpenDocument("diploma")}
              variant="outlined"
            />
            <Button
              icon={<HandwrittenIcon className="size-4" icon="view" />}
              label={about.resumeCta}
              onClick={() => setOpenDocument("resume")}
              variant="outlined"
            />
          </div>

          <div className="mt-8">
            <p className="mono mb-4 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{about.capabilitiesLabel}</p>
            <div className="flex flex-wrap gap-2">
              {about.capabilities.map((capability) => (
                <Chip key={capability} size="sm">
                  {capability}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: orbital on lg, responsive card below lg */}
        <div className="lg:flex lg:self-center lg:justify-center">
          <AboutDesktopIllustration profileAlt={about.profileAlt} />
          <AboutResponsiveCard profileAlt={about.profileAlt} />
        </div>
      </div>
      <PdfModal
        closeLabel={dictionary.modals.closeLabel}
        config={diplomaConfig}
        isOpen={openDocument === "diploma"}
        onClose={() => setOpenDocument(null)}
      />
      <PdfModal
        closeLabel={dictionary.modals.closeLabel}
        config={resumeConfig}
        isOpen={openDocument === "resume"}
        onClose={() => setOpenDocument(null)}
      />
    </SectionShell>
  );
}

function ServicesSection() {
  const { dictionary, language } = useLanguage();
  const t = dictionary.services;
  const [infoService, setInfoService] = useState<Service | null>(null);
  const [requestService, setRequestService] = useState<ServiceRequestTarget | null>(null);
  const [isHandingOffRequest, setIsHandingOffRequest] = useState(false);
  const customService = createCustomServiceRequestTarget(t.customTitle, t.customDescription);

  function handleRequestFromInfo(service: Service) {
    setIsHandingOffRequest(true);
    setInfoService(null);
    setRequestService(service);
  }

  return (
    <SectionShell className="hairline-t hairline-b bg-surface/40" id="services">
      <SectionHeading description={t.description} label={t.label} title={t.title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <CardSurface className="service-card group flex min-h-72 flex-col" key={service.id}>
              <span className="grid size-10 place-items-center rounded-2xl border border-border bg-surface transition-colors group-hover:bg-foreground group-hover:text-background">
                <HandwrittenIcon
                  className="size-5"
                  icon={SERVICE_ICON_BY_ID[service.id]}
                  size={20}
                />
            </span>
            <h3 className="mt-6 text-base font-semibold tracking-[-0.01em] text-foreground">{service.title[language]}</h3>
            <p className="mt-4 flex-1 text-sm leading-6 text-body-foreground">{service.description[language]}</p>
            <p className="service-outcome mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
              <HandwrittenIcon
                className="mt-0.5 size-4 shrink-0"
                icon={
                  service.id === "web-audit"
                    ? "valueAudit"
                    : service.id === "landing"
                      ? "valueLanding"
                      : service.id === "ecommerce"
                        ? "valueEcommerce"
                        : "valueAutomation"
                }
              />
              {service.details.result[language]}
            </p>
            {/* Divider above CTA row */}
            <div className="hairline-t mt-6 pt-4 flex items-center justify-between gap-4">
              <Button
                icon={
                  <HandwrittenIcon className="size-3.5" fallbackSrc="about" size={14} />
                }
                iconPosition="start"
                label={t.moreInfo}
                onClick={() => {
                  setIsHandingOffRequest(false);
                  setInfoService(service);
                }}
                size="sm"
                variant="ghost"
              />
              <Button
                icon={
                  <HandwrittenIcon className="size-3.5" fallbackSrc="request" size={14} />
                }
                label={t.request}
                onClick={() => setRequestService(service)}
                onFocus={preloadServiceRequestModal}
                onMouseEnter={preloadServiceRequestModal}
                size="sm"
                variant="ghost"
              />
            </div>
          </CardSurface>
        ))}
      </div>

      {/* Custom software banner — opposite theme treatment */}
      <div className="mt-6 grid gap-6 rounded-[20px] border border-border bg-foreground px-6 py-6 md:grid-cols-[1fr_auto] md:items-center dark:border-border-strong">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-background">{t.customTitle}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-background/70">{t.customDescription}</p>
        </div>
        <Button
          className="w-full md:w-auto"
          icon={<HandwrittenIcon className="size-3.5" fallbackSrc="request" size={14} />}
          label={t.request}
          onClick={() => setRequestService(customService)}
          onFocus={preloadServiceRequestModal}
          onMouseEnter={preloadServiceRequestModal}
          variant="inverse"
        />
      </div>
      <ServiceInfoModal
        closeLabel={dictionary.modals.closeLabel}
        isOpen={Boolean(infoService)}
        language={language}
        onClose={() => setInfoService(null)}
        onRequest={handleRequestFromInfo}
        restoreFocus={!isHandingOffRequest}
        service={infoService}
      />
      {requestService ? (
        <ServiceRequestModal
          closeLabel={dictionary.modals.closeLabel}
          dictionary={dictionary}
          isOpen={Boolean(requestService)}
          key={requestService.id}
          language={language}
          onClose={() => setRequestService(null)}
          service={requestService}
        />
      ) : null}
    </SectionShell>
  );
}

function StackSection() {
  const { dictionary, language } = useLanguage();
  const stack = dictionary.stack;

  return (
    <SectionShell className="hairline-b bg-surface/40" id="stack">
      <SectionHeading description={stack.description} label={stack.label} title={stack.title} />
      <div className="grid gap-3 sm:grid-cols-2">
        {stackCategories.map((category, index) => (
          <CardSurface className="hover:border-border" key={category.id}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{category.title[language]}</h3>
              <span className="mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {category.tools.map((tool) => (
                <Chip className="gap-1.5 stack-tech-chip" key={`${category.id}-${tool.name}`}>
                  <TechnologyIcon className="size-3.5 text-foreground" name={tool.name} size={14} />
                  {tool.name}
                </Chip>
              ))}
            </div>
          </CardSurface>
        ))}
      </div>
    </SectionShell>
  );
}

function ContactSection() {
  const { dictionary, language } = useLanguage();
  const contact = dictionary.contact;
  const meeting = dictionary.meeting.contact;
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionBinding, setSubmissionBinding] = useState<{ fingerprint: string; key: string } | null>(null);
  const scheduleBannerRef = useRef<HTMLDivElement | null>(null);
  const [isContactIllustrationVisible, setIsContactIllustrationVisible] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<GeneralContactFormValues>({
    mode: "onBlur",
    resolver: zodResolver(generalContactFormSchema),
  });
  const emailError = translateFormError(dictionary, errors.email?.message);
  const messageError = translateFormError(dictionary, errors.message?.message);

  useEffect(() => {
    if (!toastVisible) {
      return;
    }

    const timeout = window.setTimeout(() => setToastVisible(false), 4500);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

  useEffect(() => {
    const banner = scheduleBannerRef.current;
    if (!banner) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsContactIllustrationVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );

    observer.observe(banner);
    return () => observer.disconnect();
  }, []);

  async function onSubmit(values: GeneralContactFormValues) {
    if (isSubmitting) return;

    const fingerprint = JSON.stringify(values);
    const idempotencyKey = submissionBinding?.fingerprint === fingerprint ? submissionBinding.key : crypto.randomUUID();
    setSubmissionBinding({ fingerprint, key: idempotencyKey });
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({ ...values, idempotencyKey, locale: language, type: "contact_message" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result: unknown = await response.json().catch(() => null);
      const success = response.ok && typeof result === "object" && result !== null && (result as { success?: unknown }).success === true;
      setToastMessage(success ? contact.successMessage : contact.errorMessage);
      if (success) {
        setSubmissionBinding(null);
        reset();
      }
    } catch {
      setToastMessage(contact.errorMessage);
    } finally {
      setToastVisible(true);
      setIsSubmitting(false);
    }
  }

  return (
    <SectionShell className="lg:py-36" id="contact">
      {/* Pass empty description so SectionHeading stays centered without noisy copy */}
      <SectionHeading className="text-center lg:block" description={contact.description} label={contact.label} title={contact.title} />
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
        <form className="space-y-5 lg:col-span-3" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="contact-email" required>{contact.emailLabel}</Label>
            <Input
              aria-describedby={emailError ? "contact-email-error" : undefined}
              aria-invalid={Boolean(emailError)}
              id="contact-email"
              placeholder={contact.emailPlaceholder}
              type="email"
              {...register("email")}
            />
            <FormError id="contact-email-error">{emailError}</FormError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message" required>{contact.messageLabel}</Label>
            <Textarea
              aria-describedby={messageError ? "contact-message-error" : undefined}
              aria-invalid={Boolean(messageError)}
              id="contact-message"
              placeholder={contact.messagePlaceholder}
              {...register("message")}
            />
            <FormError id="contact-message-error">{messageError}</FormError>
          </div>
          {/* Submit button centered below the form */}
          <div className="flex justify-center">
            <Button
              icon={
                  <HandwrittenIcon className="size-4" icon="send" />
              }
              label={isSubmitting ? dictionary.forms.common.submitting : contact.submit}
              aria-busy={isSubmitting}
              disabled={isSubmitting}
              type="submit"
            />
          </div>
        </form>

        <aside className="lg:col-span-2" aria-label={contact.linksLabel}>
          <div className="grid gap-3">
            {([
               ["Email", contactLinks.email, "email"],
              ["LinkedIn", contactLinks.linkedIn, "linkedIn"],
              ["GitHub", contactLinks.github, "github"],
              ["WhatsApp", contactLinks.whatsApp, "whatsapp"],
            ] as const).map(([label, href, icon]) => (
              <a
                className="flex items-center justify-between gap-4 rounded-[20px] border border-border bg-card px-5 py-4 text-sm text-foreground transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                data-action="link"
                href={href}
                key={label}
                rel="noreferrer"
                target={href.startsWith("http") ? "_blank" : undefined}
              >
                <span className="inline-flex items-center gap-3">
                   <HandwrittenIcon className="size-5" icon={icon} size={20} />
                  {label}
                </span>
                 <HandwrittenIcon className="size-4" fallbackSrc="request" />
              </a>
            ))}
          </div>
        </aside>
      </div>
      <div className="mt-8" ref={scheduleBannerRef}>
        <div className="relative">
          <div className="rounded-[24px] border border-foreground bg-foreground px-6 py-5 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:px-7">
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-background">{meeting.title}</p>
              <p className="mt-2 text-base leading-7 text-background/70 md:text-sm md:leading-6">{meeting.subtitle}</p>
            </div>
            <Button
              className="mt-5 w-full md:mt-0 md:w-auto"
              icon={
                 <HandwrittenIcon className="size-4" icon="handshake" />
              }
              label={meeting.cta}
              onClick={() => setMeetingOpen(true)}
              onFocus={preloadMeetingModal}
              onMouseEnter={preloadMeetingModal}
              variant="inverse"
            />
           </div>
           <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
             <HandwrittenIcon className="size-4" icon="phone" />
             {language === "es" ? "Respuesta en menos de 24 h" : "< 24h response"}
           </p>
          <div
            aria-hidden="true"
            className="contact-illustration-reveal pointer-events-none absolute top-[calc(50%-1.75rem)] left-[calc(100%-1.25rem)] hidden h-[175px] w-[150px] -translate-y-1/2 min-[1460px]:block"
            data-contact-illustration-visible={isContactIllustrationVisible}
          >
            <Image alt="" className="h-full w-full dark:invert" height={175} src="/contactIlustration.svg" width={150} />
          </div>
        </div>
      </div>
      <MeetingModal
        closeLabel={dictionary.modals.closeLabel}
        dictionary={dictionary}
        isOpen={meetingOpen}
        language={language}
        onClose={() => setMeetingOpen(false)}
        origin="contact"
      />
      <Toast isVisible={toastVisible} message={toastMessage} variant={toastMessage === contact.successMessage ? "success" : "error"} />
    </SectionShell>
  );
}

function PortfolioFooter() {
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
        <p className="text-sm text-muted-foreground md:text-right">
          {footer.copyrightPrefix} {year} {footer.name}
        </p>
      </div>
    </footer>
  );
}

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
