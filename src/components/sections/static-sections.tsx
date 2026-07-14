"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { MeetingModal } from "@/components/forms/meeting-modal";
import { generalContactFormSchema, type GeneralContactFormValues } from "@/components/forms/schemas";
import { createCustomServiceRequestTarget, ServiceRequestModal, type ServiceRequestTarget } from "@/components/forms/service-request-modal";
import { useLanguage } from "@/components/providers/language-provider";
import { assets, aboutOrbitTech, contactLinks, services, stackCategories, type Service } from "@/data/content";
import { Button, CardSurface, Chip, FormError, Input, Label, PdfModal, SectionHeading, SectionShell, ServiceInfoModal, Textarea, Toast } from "@/components/ui";

// Outer orbit ring: 7 icons, clockwise rotation.
// Each icon counter-rotates so it stays upright.
const OUTER_RING = aboutOrbitTech.slice(0, 4);
// Inner orbit ring: remaining icons, counter-clockwise.
const INNER_RING = aboutOrbitTech.slice(4);

const DARK_INVERT_STACK_ICON_NAMES = new Set(["Railway", "VPS", "CI/CD", "n8n", "MCP", "Webhooks"]);

function translateFormError(dictionary: ReturnType<typeof useLanguage>["dictionary"], message?: string) {
  if (!message) {
    return undefined;
  }

  const key = message.replace("forms.errors.", "") as keyof typeof dictionary.forms.errors;
  return dictionary.forms.errors[key] ?? message;
}

function AboutDesktopIllustration({ profileAlt }: { profileAlt: string }) {
  return (
    // Compact column: max-w-sm keeps it from being too large on lg
    <div className="relative mx-auto hidden aspect-square w-full max-w-sm lg:block">
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
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-5"
                    height={20}
                    src={tech.icon}
                    width={20}
                  />
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
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="size-5"
                    height={20}
                    src={tech.icon}
                    width={20}
                  />
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
    <div className="lg:hidden">
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
              <Image
                alt=""
                aria-hidden="true"
                className="size-3.5"
                height={14}
                src={tech.icon}
                width={14}
              />
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
            <h3 className="text-lg leading-7 font-semibold tracking-[-0.02em] text-foreground">{about.introHeading}</h3>
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <CardSurface className="mt-6 hover:border-border">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-5 shrink-0 dark:invert"
                  height={24}
                  src="/handwritten-icons/education.svg"
                  width={24}
                />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{about.educationHeading}</h3>
                <p className="mt-3 text-sm leading-6 text-body-foreground">{about.educationInstitution}</p>
                <p className="mono mt-1 text-xs text-muted-foreground">{about.educationDetail}</p>
              </div>
            </div>
          </CardSurface>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => setOpenDocument("diploma")}
              type="button"
            >
              {about.diplomaCta}
              <Image
                alt=""
                aria-hidden="true"
                className="size-4 transition group-hover:invert dark:invert dark:group-hover:invert-0"
                height={16}
                src="/handwritten-icons/diploma.svg"
                width={16}
              />
            </button>
            <button
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => setOpenDocument("resume")}
              type="button"
            >
              {about.resumeCta}
              <Image
                alt=""
                aria-hidden="true"
                className="size-4 transition group-hover:invert dark:invert dark:group-hover:invert-0"
                height={16}
                src={assets.icons.view}
                width={16}
              />
            </button>
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
        isOpen={openDocument === "diploma"}
        onClose={() => setOpenDocument(null)}
        src={assets.diploma}
        title={dictionary.modals.diplomaTitle}
      />
      <PdfModal
        closeLabel={dictionary.modals.closeLabel}
        isOpen={openDocument === "resume"}
        onClose={() => setOpenDocument(null)}
        src={assets.resume[language]}
        title={dictionary.modals.resumeTitle}
      />
    </SectionShell>
  );
}

function ServicesSection() {
  const { dictionary, language } = useLanguage();
  const t = dictionary.services;
  const [infoService, setInfoService] = useState<Service | null>(null);
  const [requestService, setRequestService] = useState<ServiceRequestTarget | null>(null);
  const customService = createCustomServiceRequestTarget(t.customTitle, t.customDescription);

  function handleRequestFromInfo(service: Service) {
    setInfoService(null);
    setRequestService(service);
  }

  return (
    <SectionShell className="hairline-t hairline-b bg-surface/40" id="services">
      <SectionHeading description={t.description} label={t.label} title={t.title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <CardSurface className="group flex min-h-72 flex-col" key={service.id}>
            <span className="grid size-10 place-items-center rounded-2xl border border-border bg-surface transition-colors group-hover:bg-foreground">
              <Image
                alt=""
                aria-hidden="true"
                className="size-5 transition dark:invert group-hover:invert dark:group-hover:invert-0"
                height={20}
                src={service.icon}
                width={20}
              />
            </span>
            <h3 className="mt-6 text-base font-semibold tracking-[-0.01em] text-foreground">{service.title[language]}</h3>
            <p className="mt-4 flex-1 text-sm leading-6 text-body-foreground">{service.description[language]}</p>
            {/* Divider above CTA row */}
            <div className="hairline-t mt-6 pt-4 flex items-center justify-between gap-4">
              <button
                className="mono inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setInfoService(service)}
                type="button"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-3.5 dark:invert"
                  height={14}
                  src={assets.icons.about}
                  width={14}
                />
                {t.moreInfo}
              </button>
              <button
                className="mono inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setRequestService(service)}
                type="button"
              >
                {t.request}
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-3.5 dark:invert"
                  height={14}
                  src={assets.icons.request}
                  width={14}
                />
              </button>
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
        <button
          aria-label={t.request}
          className="group inline-flex items-center justify-center gap-2 rounded-full border border-background/30 px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
          onClick={() => setRequestService(customService)}
          type="button"
        >
          {t.request}
          <Image
            alt=""
            aria-hidden="true"
            className="size-3.5 invert transition group-hover:invert-0 dark:invert-0 dark:group-hover:invert"
            height={14}
            src={assets.icons.request}
            width={14}
          />
        </button>
      </div>
      <ServiceInfoModal
        closeLabel={dictionary.modals.closeLabel}
        isOpen={Boolean(infoService)}
        language={language}
        onClose={() => setInfoService(null)}
        onRequest={handleRequestFromInfo}
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
                <Chip className="gap-1.5 hover:bg-foreground hover:text-background" key={`${category.id}-${tool.name}`}>
                  <Image
                    alt=""
                    aria-hidden="true"
                    className={`size-3.5 ${DARK_INVERT_STACK_ICON_NAMES.has(tool.name) ? "dark:invert" : ""}`}
                    height={14}
                    src={tool.icon || assets.iconFallback}
                    width={14}
                  />
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

  function onSubmit() {
    setToastVisible(true);
    reset();
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
            <Button type="submit">
              {contact.submit}
              {/* airplane icon: white on dark primary button in light mode, dark on light primary button in dark mode */}
              <Image
                alt=""
                aria-hidden="true"
                className="size-4 invert dark:invert-0"
                height={16}
                src={assets.icons.airplane}
                width={16}
              />
            </Button>
          </div>
        </form>

        <aside className="lg:col-span-2" aria-label={contact.linksLabel}>
          <div className="grid gap-3">
            {[
              ["Email", contactLinks.email, "/handwritten-icons/card.svg"],
              ["LinkedIn", contactLinks.linkedIn, "/handwritten-icons/linkedIn.svg"],
              ["GitHub", contactLinks.github, "/handwritten-icons/github.svg"],
              ["WhatsApp", contactLinks.whatsApp, "/handwritten-icons/whatsapp.svg"],
            ].map(([label, href, icon]) => (
              <a
                className="flex items-center justify-between gap-4 rounded-[20px] border border-border bg-card px-5 py-4 text-sm text-foreground transition-colors hover:border-border-strong"
                href={href}
                key={label}
                rel="noreferrer"
                target={href.startsWith("http") ? "_blank" : undefined}
              >
                <span className="inline-flex items-center gap-3">
                  <Image alt="" aria-hidden="true" className="size-5 dark:invert" height={20} src={icon} width={20} />
                  {label}
                </span>
                <Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src={assets.icons.request} width={16} />
              </a>
            ))}
          </div>
        </aside>
      </div>
      <div className="mt-8 rounded-[24px] border border-foreground bg-foreground px-6 py-5 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:px-7">
        <div>
          <p className="text-lg font-semibold tracking-[-0.02em] text-background">{meeting.title}</p>
          <p className="mt-2 text-base leading-7 text-background/70 md:text-sm md:leading-6">{meeting.subtitle}</p>
        </div>
        <button
          className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-background/30 bg-background px-5 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-background/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background md:mt-0 md:w-auto md:text-sm"
          onClick={() => setMeetingOpen(true)}
          type="button"
        >
          {meeting.cta}
          <Image
            alt=""
            aria-hidden="true"
            className="size-4 dark:invert"
            height={16}
            src="/handwritten-icons/calendar.svg"
            width={16}
          />
        </button>
      </div>
      <MeetingModal
        closeLabel={dictionary.modals.closeLabel}
        dictionary={dictionary}
        isOpen={meetingOpen}
        language={language}
        onClose={() => setMeetingOpen(false)}
        origin="contact"
      />
      <Toast isVisible={toastVisible} message={contact.toastPlaceholder} />
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
