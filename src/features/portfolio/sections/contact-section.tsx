"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { generalContactFormSchema, type GeneralContactFormValues } from "@/components/forms/schemas";
import { useLanguage } from "@/components/providers/language-provider";
import { Button, FormError, HandwrittenIcon, Input, Label, SectionHeading, SectionShell, Textarea, Toast } from "@/components/ui";
import { contactLinks } from "@/data/content";

const MeetingModal = dynamic(
  () => import("@/components/forms/meeting-modal").then((m) => ({ default: m.MeetingModal })),
  { ssr: false },
);

function preloadMeetingModal() {
  void import("@/components/forms/meeting-modal");
}

function translateFormError(dictionary: ReturnType<typeof useLanguage>["dictionary"], message?: string) {
  if (!message) {
    return undefined;
  }
  const key = message.replace("forms.errors.", "") as keyof typeof dictionary.forms.errors;
  return dictionary.forms.errors[key] ?? message;
}

export function ContactSection() {
  const { dictionary, language } = useLanguage();
  const contact = dictionary.contact;
  const meeting = dictionary.meeting.contact;
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionBinding, setSubmissionBinding] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
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
    if (!banner) {
      return;
    }
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
    if (isSubmitting) {
      return;
    }
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
      <SectionHeading
        className="text-center lg:block"
        description={contact.description}
        label={contact.label}
        title={contact.title}
      />
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
        <form
          className="space-y-5 lg:col-span-3"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="space-y-2"><Label htmlFor="contact-email" required>{contact.emailLabel}</Label><Input aria-describedby={emailError ? "contact-email-error" : undefined} aria-invalid={Boolean(emailError)} id="contact-email" placeholder={contact.emailPlaceholder} type="email" {...register("email")} /><FormError id="contact-email-error">{emailError}</FormError></div>
          <div className="space-y-2"><Label htmlFor="contact-message" required>{contact.messageLabel}</Label><Textarea aria-describedby={messageError ? "contact-message-error" : undefined} aria-invalid={Boolean(messageError)} id="contact-message" placeholder={contact.messagePlaceholder} {...register("message")} /><FormError id="contact-message-error">{messageError}</FormError></div>
           <div className="flex justify-center">
             <Button
               aria-busy={isSubmitting}
               disabled={isSubmitting}
               icon={<HandwrittenIcon className="size-4" icon="send" />}
               label={isSubmitting ? dictionary.forms.common.submitting : contact.submit}
               type="submit"
             />
           </div>
        </form>
        <aside className="lg:col-span-2" aria-label={contact.linksLabel}><div className="grid gap-3">{([ ["Email", contactLinks.email, "email"], ["LinkedIn", contactLinks.linkedIn, "linkedIn"], ["GitHub", contactLinks.github, "github"], ["WhatsApp", contactLinks.whatsApp, "whatsapp"] ] as const).map(([label, href, icon]) => <a className="flex items-center justify-between gap-4 rounded-[20px] border border-border bg-card px-5 py-4 text-sm text-foreground transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground" data-action="link" href={href} key={label} rel="noreferrer" target={href.startsWith("http") ? "_blank" : undefined}><span className="inline-flex items-center gap-3"><HandwrittenIcon className="size-5" icon={icon} size={20} />{label}</span><HandwrittenIcon className="size-4" fallbackSrc="request" /></a>)}</div></aside>
      </div>
      <div className="mt-8" ref={scheduleBannerRef}><div className="relative"><div className="rounded-[24px] border border-foreground bg-foreground px-6 py-5 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:px-7"><div><p className="text-lg font-semibold tracking-[-0.02em] text-background">{meeting.title}</p><p className="mt-2 text-base leading-7 text-background/70 md:text-sm md:leading-6">{meeting.subtitle}</p></div><Button className="mt-5 w-full md:mt-0 md:w-auto" icon={<HandwrittenIcon className="size-4" icon="handshake" />} label={meeting.cta} onClick={() => setMeetingOpen(true)} onFocus={preloadMeetingModal} onMouseEnter={preloadMeetingModal} variant="inverse" /></div><p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><HandwrittenIcon className="size-4" icon="phone" />{language === "es" ? "Respuesta en menos de 24 h" : "< 24h response"}</p><div aria-hidden="true" className="contact-illustration-reveal pointer-events-none absolute top-[calc(50%-1.75rem)] left-[calc(100%-1.25rem)] hidden h-[175px] w-[150px] -translate-y-1/2 min-[1460px]:block" data-contact-illustration-visible={isContactIllustrationVisible}><Image alt="" className="h-full w-full dark:invert" height={175} src="/contactIlustration.svg" width={150} /></div></div></div>
      <MeetingModal closeLabel={dictionary.modals.closeLabel} dictionary={dictionary} isOpen={meetingOpen} language={language} onClose={() => setMeetingOpen(false)} origin="contact" />
      <Toast isVisible={toastVisible} message={toastMessage} variant={toastMessage === contact.successMessage ? "success" : "error"} />
    </SectionShell>
  );
}
