"use client";

import type { Dictionary } from "@/lib/i18n";
import { ActionLink, Button } from "@/components/ui";

type MeetingSuccessProps = {
  dictionary: Dictionary;
  onClose: () => void;
  whatsappUrl?: string;
};

export function MeetingSuccess({ dictionary, onClose, whatsappUrl }: MeetingSuccessProps) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="space-y-3">
        <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {dictionary.meeting.title}
        </p>
        <h3 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
          {dictionary.meeting.success.title}
        </h3>
        <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
          {dictionary.meeting.success.message}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onClose}>{dictionary.meeting.actions.close}</Button>
        {whatsappUrl ? (
          <ActionLink
            href={whatsappUrl}
            label={dictionary.meeting.actions.whatsapp}
            rel="noreferrer"
            size="md"
            target="_blank"
            variant="outlined"
          />
        ) : null}
      </div>
    </div>
  );
}
