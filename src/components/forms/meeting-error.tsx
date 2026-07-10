"use client";

import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { createWhatsAppUrl } from "./whatsapp-link";

type MeetingErrorProps = {
  dictionary: Dictionary;
  message?: string;
  onRetry: () => void;
  whatsappMessage: string;
};

export function MeetingError({ dictionary, message, onRetry, whatsappMessage }: MeetingErrorProps) {
  const whatsappUrl = createWhatsAppUrl(whatsappMessage);

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4">
        <p className="mono text-[11px] tracking-[0.18em] text-red-500 uppercase">
          {dictionary.meeting.error.title}
        </p>
        <p className="text-base leading-7 text-red-500 md:text-sm md:leading-6">
          {message || dictionary.meeting.error.message}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRetry}>{dictionary.meeting.actions.retry}</Button>
        <a
          className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-5 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
          href={whatsappUrl}
          rel="noreferrer"
          target="_blank"
        >
          {dictionary.meeting.actions.whatsapp}
        </a>
      </div>
    </div>
  );
}
