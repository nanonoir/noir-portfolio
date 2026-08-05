"use client";

import type { Dictionary } from "@/lib/i18n";
import { ActionLink, Button } from "@/components/ui";
import { createWhatsAppUrl } from "./whatsapp-link";

type MeetingErrorProps = {
  code?: string;
  dictionary: Dictionary;
  message?: string;
  onBackToForm: () => void;
  onRetry: () => void;
  whatsappMessage: string;
};

export function MeetingError({ code, dictionary, message, onBackToForm, onRetry, whatsappMessage }: MeetingErrorProps) {
  const whatsappUrl = createWhatsAppUrl(whatsappMessage);

  return (
    <div className="space-y-5" role="alert" aria-live="assertive">
      <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4">
        <p className="mono text-[11px] tracking-[0.18em] text-red-500 uppercase">
          {dictionary.meeting.error.title}
        </p>
        <p className="text-base leading-7 text-red-500 md:text-sm md:leading-6">
          {message || dictionary.meeting.error.message}
        </p>
        {code ? <p className="mono text-[11px] tracking-[0.12em] text-red-500/80">{code}</p> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outlined" onClick={onBackToForm}>{dictionary.meeting.actions.backToForm}</Button>
        <Button onClick={onRetry}>{dictionary.meeting.actions.retry}</Button>
        <ActionLink
          href={whatsappUrl}
          label={dictionary.meeting.actions.whatsapp}
          rel="noreferrer"
          size="md"
          target="_blank"
          variant="outlined"
        />
      </div>
    </div>
  );
}
