"use client";

import type { Dictionary } from "@/lib/i18n";
import { Button, FormError } from "@/components/ui";
import type { AvailabilitySlot, AvailabilityState } from "./meeting-calendar";

type MeetingSlotsProps = {
  dictionary: Dictionary;
  error?: string;
  id?: string;
  onRetry: () => void;
  onSelect: (time: string) => void;
  selectedTime: string;
  state: AvailabilityState;
  whatsappUrl: string;
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) return undefined;

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];

  return dictionary.forms.errors[key] ?? message;
}

function SlotButton({
  isSelected,
  onSelect,
  slot,
}: {
  isSelected: boolean;
  onSelect: (time: string) => void;
  slot: AvailabilitySlot;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={[
        "rounded-2xl border px-4 py-3 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm",
        isSelected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-surface/30 text-body-foreground hover:border-foreground/50 hover:bg-surface/70",
        !slot.available ? "cursor-not-allowed opacity-40" : "",
      ].filter(Boolean).join(" ")}
      disabled={!slot.available}
      type="button"
      onClick={() => onSelect(slot.time)}
    >
      {slot.time}
    </button>
  );
}

export function MeetingSlots({
  dictionary,
  error,
  id = "time",
  onRetry,
  onSelect,
  selectedTime,
  state,
  whatsappUrl,
}: MeetingSlotsProps) {
  const errorId = `${id}-error`;
  const translatedError = translateError(dictionary, error);

  return (
    <fieldset aria-describedby={translatedError ? errorId : undefined} className="space-y-3">
      <legend className="text-base font-medium text-foreground md:text-sm">
        {dictionary.meeting.fields.time}
        <span className="ml-1 text-muted-foreground" aria-hidden="true">*</span>
      </legend>

      {state.status === "idle" ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/20 px-4 py-4 text-base text-muted-foreground md:text-sm">
          {dictionary.forms.errors.dateRequired}
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="rounded-2xl border border-border bg-surface/30 px-4 py-4 text-base text-body-foreground md:text-sm" role="status">
          {dictionary.meeting.availability.loading}
        </div>
      ) : null}

      {state.status === "empty" ? (
        <div className="rounded-2xl border border-border bg-surface/30 px-4 py-4 text-base text-body-foreground md:text-sm">
          {dictionary.meeting.availability.empty}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4">
          <p className="text-base text-red-500 md:text-sm">
            {state.message || dictionary.meeting.availability.error}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outlined" onClick={onRetry}>{dictionary.meeting.actions.retry}</Button>
            <a
              className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              href={whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              {dictionary.meeting.actions.whatsapp}
            </a>
          </div>
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.slots.map((slot) => (
            <SlotButton
              key={slot.time}
              isSelected={selectedTime === slot.time}
              slot={slot}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      {translatedError ? <FormError id={errorId}>{translatedError}</FormError> : null}
    </fieldset>
  );
}
