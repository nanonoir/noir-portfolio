"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Dictionary } from "@/lib/i18n";
import { FormError, Input, Label } from "@/components/ui";

const TIMEZONE = "America/Argentina/Buenos_Aires";
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

type ParsedDate = {
  date: Date;
  day: number;
  month: number;
  year: number;
};

function parseDate(value: string): ParsedDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { date, day, month, year };
}

function getBuenosAiresToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIMEZONE,
    year: "numeric",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSlotDate(parsedDate: ParsedDate, time: string) {
  const [hour, minute] = time.split(":").map(Number);

  return new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour + 3, minute));
}

function isSelectableDate(value: string, now = new Date()) {
  const parsedDate = parseDate(value);

  if (!parsedDate) return false;

  const weekday = parsedDate.date.getUTCDay();

  if (weekday === 0 || weekday === 6) return false;

  const today = getBuenosAiresToday(now);
  const maxDate = new Date(today);
  maxDate.setUTCDate(today.getUTCDate() + 14);

  if (parsedDate.date < today || parsedDate.date > maxDate) return false;

  const minimumTime = now.getTime() + 24 * 60 * 60 * 1000;

  return BUSINESS_TIMES.some((time) => getSlotDate(parsedDate, time).getTime() >= minimumTime);
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
  const [localError, setLocalError] = useState<string>();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const translatedError = error
    ? dictionary.forms.errors[error.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"]] ?? error
    : localError;
  const today = useMemo(() => getBuenosAiresToday(), []);
  const maxDate = useMemo(() => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + 14);
    return date;
  }, [today]);

  useEffect(() => {
    if (!value) {
      onAvailabilityChange({ status: "idle", slots: [] });
      return;
    }

    if (!isSelectableDate(value)) {
      onSlotReset();
      onAvailabilityChange({ status: "idle", slots: [] });
      return;
    }

    const controller = new AbortController();
    onAvailabilityChange({ status: "loading", slots: [] });

    fetch(`/api/availability?date=${encodeURIComponent(value)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || dictionary.meeting.availability.error);
        }

        const slots = Array.isArray(data.slots) ? (data.slots as AvailabilitySlot[]) : [];
        onAvailabilityChange({ status: slots.length > 0 ? "success" : "empty", slots });
      })
      .catch((fetchError: Error) => {
        if (controller.signal.aborted) return;

        onAvailabilityChange({
          status: "error",
          slots: [],
          message: fetchError.message || dictionary.meeting.availability.error,
        });
      });

    return () => controller.abort();
  }, [dictionary.meeting.availability.error, onAvailabilityChange, onSlotReset, value]);

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDate = event.target.value;
    onSlotReset();

    if (!nextDate) {
      setLocalError(undefined);
      onChange("");
      return;
    }

    if (!isSelectableDate(nextDate)) {
      setLocalError(dictionary.forms.errors.dateRequired);
      onChange("");
      return;
    }

    setLocalError(undefined);
    onChange(nextDate);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input
        aria-describedby={translatedError ? errorId : helper ? helperId : undefined}
        aria-invalid={Boolean(translatedError)}
        id={id}
        max={formatDateInput(maxDate)}
        min={formatDateInput(today)}
        type="date"
        value={value}
        onChange={handleDateChange}
      />
      {translatedError ? (
        <FormError id={errorId}>{translatedError}</FormError>
      ) : helper ? (
        <p className="text-base text-muted-foreground md:text-sm" id={helperId}>{helper}</p>
      ) : null}
    </div>
  );
}
