"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Dictionary } from "@/lib/i18n";
import { FormError, Label } from "@/components/ui";

const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Minimum lead time in milliseconds — shared with the API route. */
export const MIN_LEAD_TIME_MS = 12 * 60 * 60 * 1000;

const BUSINESS_TIMES = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
] as const;

export type AvailabilitySlot = {
  time: string;
  available: boolean;
};

export type AvailabilityState =
  | { status: "idle"; slots: AvailabilitySlot[] }
  | { status: "loading"; slots: AvailabilitySlot[] }
  | { status: "success"; slots: AvailabilitySlot[] }
  | { status: "empty"; slots: AvailabilitySlot[] }
  | { status: "error"; slots: AvailabilitySlot[]; message?: string };

type MeetingCalendarProps = {
  dictionary: Dictionary;
  error?: string;
  helper?: string;
  id?: string;
  label?: string;
  onAvailabilityChange: (state: AvailabilityState) => void;
  onChange: (date: string) => void;
  onSlotReset: () => void;
  required?: boolean;
  value: string;
};

type DateCandidate = {
  /** ISO date string: YYYY-MM-DD */
  iso: string;
  /** UTC day-of-week: 0 = Sun, 6 = Sat */
  weekday: number;
  label: string;
  dayLabel: string;
};

function getBuenosAiresToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIMEZONE,
    year: "numeric",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUTCDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Returns the earliest UTC timestamp of a slot on the given ISO date,
 * adjusted for Buenos Aires UTC-3 offset.
 */
function getSlotTimestamp(iso: string, time: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  // Buenos Aires is UTC-3; add 3h to convert local to UTC
  return Date.UTC(year, month - 1, day, hour + 3, minute);
}

function hasSelectableSlot(iso: string, now: number): boolean {
  return BUSINESS_TIMES.some(
    (t) => getSlotTimestamp(iso, t) >= now + MIN_LEAD_TIME_MS,
  );
}

function buildCandidates(today: Date, now: number): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const maxDate = addUTCDays(today, 14);

  for (let d = new Date(today); d <= maxDate; d = addUTCDays(d, 1)) {
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) continue; // skip weekends

    const iso = formatIso(d);
    if (!hasSelectableSlot(iso, now)) continue; // skip under-lead-time

    // Format a short label like "14 Jul" in local display
    const label = d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    const dayLabel = d.toLocaleDateString("es-AR", {
      weekday: "short",
      timeZone: "UTC",
    });

    candidates.push({ iso, weekday, label, dayLabel });
  }

  return candidates;
}

export function MeetingCalendar({
  dictionary,
  error,
  helper,
  id = "date",
  label = dictionary.meeting.fields.date,
  onAvailabilityChange,
  onChange,
  onSlotReset,
  required = true,
  value,
}: MeetingCalendarProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const translatedError = error
    ? (dictionary.forms.errors[
        error.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"]
      ] ?? error)
    : undefined;

  const now = useRef(Date.now());
  const today = useMemo(() => getBuenosAiresToday(new Date(now.current)), []);
  const candidates = useMemo(
    () => buildCandidates(today, now.current),
    [today],
  );

  // Track active button index for arrow-key navigation
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch availability whenever the selected date changes
  useEffect(() => {
    if (!value) {
      onAvailabilityChange({ status: "idle", slots: [] });
      return;
    }

    const isValid = candidates.some((c) => c.iso === value);

    if (!isValid) {
      onSlotReset();
      onAvailabilityChange({ status: "idle", slots: [] });
      return;
    }

    const controller = new AbortController();
    onAvailabilityChange({ status: "loading", slots: [] });

    fetch(`/api/availability?date=${encodeURIComponent(value)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || dictionary.meeting.availability.error,
          );
        }

        const slots = Array.isArray(data.slots)
          ? (data.slots as AvailabilitySlot[])
          : [];
        onAvailabilityChange({
          status: slots.length > 0 ? "success" : "empty",
          slots,
        });
      })
      .catch((fetchError: Error) => {
        if (controller.signal.aborted) return;

        onAvailabilityChange({
          status: "error",
          slots: [],
          message:
            fetchError.message || dictionary.meeting.availability.error,
        });
      });

    return () => controller.abort();
  }, [
    candidates,
    dictionary.meeting.availability.error,
    onAvailabilityChange,
    onSlotReset,
    value,
  ]);

  function handleSelect(iso: string, index: number) {
    onSlotReset();
    onChange(iso);
    setFocusIndex(index);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!candidates.length) return;

    const currentIndex = focusIndex < 0 ? 0 : focusIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(currentIndex + 1, candidates.length - 1);
      setFocusIndex(next);
      buttonRefs.current[next]?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(currentIndex - 1, 0);
      setFocusIndex(prev);
      buttonRefs.current[prev]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusIndex(0);
      buttonRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const last = candidates.length - 1;
      setFocusIndex(last);
      buttonRefs.current[last]?.focus();
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {candidates.length === 0 ? (
        <p className="text-base text-muted-foreground md:text-sm">
          {dictionary.meeting.availability.empty}
        </p>
      ) : (
        /* Role="group" with keyboard navigation handled at div level */
        <div
          aria-describedby={translatedError ? errorId : helper ? helperId : undefined}
          aria-invalid={Boolean(translatedError)}
          aria-label={label}
          className="flex flex-wrap gap-2"
          onKeyDown={handleKeyDown}
          role="group"
        >
          {candidates.map((candidate, index) => {
            const isSelected = candidate.iso === value;

            return (
              <button
                key={candidate.iso}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                aria-label={`${candidate.dayLabel} ${candidate.label}`}
                aria-pressed={isSelected}
                aria-selected={isSelected}
                className={[
                  // Base: 44px minimum touch target, adequate padding
                  "inline-flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-2xl border px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  // Selected state: high contrast, inverse pill
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:border-border-strong hover:bg-surface",
                  // Reduced motion: no transition animation
                  "motion-reduce:transition-none",
                ].join(" ")}
                tabIndex={isSelected ? 0 : focusIndex === index ? 0 : -1}
                type="button"
                onClick={() => handleSelect(candidate.iso, index)}
                onFocus={() => setFocusIndex(index)}
              >
                <span className="mono text-[10px] leading-none text-current/70 capitalize">
                  {candidate.dayLabel}
                </span>
                <span className="mt-0.5 leading-none">{candidate.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {translatedError ? (
        <FormError id={errorId}>{translatedError}</FormError>
      ) : helper ? (
        <p className="text-base text-muted-foreground md:text-sm" id={helperId}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}
