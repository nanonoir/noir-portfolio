"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { Language } from "@/lib/i18n";
import { generalContactFormSchema, type GeneralContactFormValues } from "./contact-schema";

type UseContactFormInput = {
  errorMessage: string;
  language: Language;
  successMessage: string;
};

export function useContactForm({ errorMessage, language, successMessage }: UseContactFormInput) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionBinding, setSubmissionBinding] = useState<{ fingerprint: string; key: string } | null>(null);
  const form = useForm<GeneralContactFormValues>({
    mode: "onBlur",
    resolver: zodResolver(generalContactFormSchema),
  });

  useEffect(() => {
    if (!toastVisible) return;

    const timeout = window.setTimeout(() => setToastVisible(false), 4500);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

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
      setToastMessage(success ? successMessage : errorMessage);
      if (success) {
        setSubmissionBinding(null);
        form.reset();
      }
    } catch {
      setToastMessage(errorMessage);
    } finally {
      setToastVisible(true);
      setIsSubmitting(false);
    }
  }

  return { ...form, isSubmitting, onSubmit, toastMessage, toastVisible };
}
