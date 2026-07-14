"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, Modal } from "@/components/ui";
import {
  addCalendarDays,
  getDateWeekday,
  getTodayInTimeZone,
  isDateWithinAvailabilityRules,
  getVisitorTimeZone,
  MAX_HORIZON_DAYS,
} from "./date-time-constants";
import type { AvailabilityState } from "./date-time-constants";
import { MeetingSlots } from "./meeting-slots";

type DateTimeSelection = {
  date: string;
  time: string;
};

type DateTimeModalProps = {
  closeLabel: string;
  dictionary: Dictionary;
  initialDate: string;
  initialTime: string;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onConfirm: (selection: DateTimeSelection) => void;
  whatsappUrl: string;
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthStart(date: string) {
  return `${getMonthKey(date)}-01`;
}

function getDaysInMonth(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthValue, 0)).getUTCDate();
}

function getMonthDays(month: string) {
  const days = getDaysInMonth(month);

  return Array.from({ length: days }, (_, index) => {
    const day = (index + 1).toString().padStart(2, "0");
    return `${month}-${day}`;
  });
}

function getMonthLabel(month: string, language: Language) {
  const [year, monthValue] = month.split("-").map(Number);
  const locale = language === "es" ? "es-AR" : "en-US";

  return new Date(Date.UTC(year, monthValue - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
}

function getDayNumber(date: string) {
  return Number(date.slice(-2));
}

function getWeekdayLabel(index: number, language: Language) {
  const locale = language === "es" ? "es-AR" : "en-US";
  const referenceDate = new Date(Date.UTC(2024, 0, 1 + index));

  return referenceDate.toLocaleDateString(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function DateTimeModal({
  closeLabel,
  dictionary,
  initialDate,
  initialTime,
  isOpen,
  language,
  onClose,
  onConfirm,
  whatsappUrl,
}: DateTimeModalProps) {
  const [now] = useState(() => new Date());
  const [timeZone] = useState(() => getVisitorTimeZone());
  const initialSelectedDate = initialDate && isDateWithinAvailabilityRules(initialDate, timeZone, now) ? initialDate : "";
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [selectedTime, setSelectedTime] = useState(initialSelectedDate ? initialTime : "");
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthKey(initialSelectedDate || getTodayInTimeZone(timeZone, now)));
  const [availability, setAvailability] = useState<AvailabilityState>(() => (
    initialSelectedDate ? { status: "loading", slots: [] } : { status: "idle", slots: [] }
  ));
  const [retryCount, setRetryCount] = useState(0);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const today = useMemo(() => getTodayInTimeZone(timeZone, now), [now, timeZone]);
  const maximumDate = useMemo(() => addCalendarDays(today, MAX_HORIZON_DAYS), [today]);
  const minimumMonth = getMonthKey(today);
  const maximumMonth = getMonthKey(maximumDate);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const leadingEmptyCells = useMemo(() => {
    const weekday = getDateWeekday(getMonthStart(visibleMonth));
    return weekday === 0 ? 6 : weekday - 1;
  }, [visibleMonth]);
  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((_, index) => getWeekdayLabel(index, language)),
    [language],
  );
  const firstFocusableDate = monthDays.find((date) => isDateWithinAvailabilityRules(date, timeZone, now));
  const tabTargetDate = monthDays.includes(selectedDate) ? selectedDate : firstFocusableDate;

  useEffect(() => {
    if (!selectedDate) return;

    const controller = new AbortController();

    fetch(`/api/availability?date=${encodeURIComponent(selectedDate)}&timezone=${encodeURIComponent(timeZone)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          const code = typeof data.error === "string" ? data.error : undefined;
          console.warn("Meeting availability failed", { code });
          setAvailability({
            status: "error",
            slots: [],
            code,
            message: dictionary.meeting.availability.error,
          });
          return;
        }

        const slots = Array.isArray(data.slots) ? data.slots : [];
        setAvailability({ status: slots.length > 0 ? "success" : "empty", slots });
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        setAvailability({
          status: "error",
          slots: [],
          message: dictionary.meeting.availability.error,
        });
      });

    return () => controller.abort();
  }, [dictionary.meeting.availability.error, retryCount, selectedDate, timeZone]);

  function isSelectableDate(date: string) {
    return isDateWithinAvailabilityRules(date, timeZone, now);
  }

  function focusDate(date: string) {
    buttonRefs.current[date]?.focus();
  }

  function focusAdjacentDate(date: string, delta: number) {
    const currentIndex = monthDays.indexOf(date);
    if (currentIndex < 0) return;

    for (let index = currentIndex + delta; index >= 0 && index < monthDays.length; index += delta) {
      if (isSelectableDate(monthDays[index])) {
        focusDate(monthDays[index]);
        return;
      }
    }
  }

  function changeMonth(delta: number) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    const nextMonth = `${next.getUTCFullYear()}-${(next.getUTCMonth() + 1).toString().padStart(2, "0")}`;

    if (nextMonth >= minimumMonth && nextMonth <= maximumMonth) {
      setVisibleMonth(nextMonth);
    }
  }

  function handleCalendarKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAdjacentDate(date, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAdjacentDate(date, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAdjacentDate(date, 7);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAdjacentDate(date, -7);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      changeMonth(1);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      changeMonth(-1);
    }
  }

  function handleDateSelect(date: string) {
    if (!isSelectableDate(date) || selectedDate === date) return;

    setSelectedDate(date);
    setSelectedTime("");
    setAvailability({ status: "loading", slots: [] });
  }

  const canConfirm = Boolean(selectedDate && selectedTime && availability.status === "success");

  return (
    <Modal
      closeLabel={closeLabel}
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button className="hidden md:inline-flex" variant="outlined" onClick={onClose}>{dictionary.meeting.dateTime.cancel}</Button>
          <Button
            disabled={!canConfirm}
            onClick={() => onConfirm({ date: selectedDate, time: selectedTime })}
          >
            {dictionary.meeting.dateTime.confirm}
          </Button>
        </div>
      )}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={dictionary.meeting.dateTime.title}
    >
      <div className="space-y-5">
        <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">
          {dictionary.meeting.dateTime.timezoneLabel}: {timeZone}
        </p>

        <section aria-labelledby="meeting-calendar-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold capitalize text-foreground md:text-sm" id="meeting-calendar-heading" aria-live="polite">
              {getMonthLabel(visibleMonth, language)}
            </h3>
            <div className="flex gap-2">
              <button
                aria-label={dictionary.meeting.dateTime.previousMonth}
                className="grid size-11 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none"
                disabled={visibleMonth <= minimumMonth}
                type="button"
                onClick={() => changeMonth(-1)}
              >
                ←
              </button>
              <button
                aria-label={dictionary.meeting.dateTime.nextMonth}
                className="grid size-11 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none"
                disabled={visibleMonth >= maximumMonth}
                type="button"
                onClick={() => changeMonth(1)}
              >
                →
              </button>
            </div>
          </div>

          <div aria-label={dictionary.meeting.dateTime.calendarLabel} className="grid grid-cols-7 gap-1.5" role="grid">
            {weekdayLabels.map((label) => (
              <span className="py-1 text-center text-[10px] font-medium text-muted-foreground capitalize" key={label} role="columnheader">
                {label}
              </span>
            ))}
            {Array.from({ length: leadingEmptyCells }, (_, index) => (
              <span aria-hidden="true" className="min-h-11" key={`empty-${index}`} />
            ))}
            {monthDays.map((date) => {
              const selectable = isSelectableDate(date);
              const selected = selectedDate === date;

              return (
                <div
                  aria-disabled={!selectable}
                  aria-selected={selected}
                  className="min-w-0"
                  key={date}
                  role="gridcell"
                >
                  <button
                    aria-label={date}
                    aria-pressed={selected}
                    className={[
                      "flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border px-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : selectable
                          ? "border-border bg-card text-foreground hover:bg-surface"
                          : "cursor-not-allowed border-border/50 bg-surface/20 text-muted-foreground/50",
                    ].join(" ")}
                    disabled={!selectable}
                    ref={(element) => {
                      buttonRefs.current[date] = element;
                    }}
                    tabIndex={date === tabTargetDate ? 0 : -1}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    onKeyDown={(event) => handleCalendarKeyDown(event, date)}
                  >
                    {getDayNumber(date)}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <MeetingSlots
          dictionary={dictionary}
          onRetry={() => {
            setAvailability({ status: "loading", slots: [] });
            setRetryCount((count) => count + 1);
          }}
          onSelect={setSelectedTime}
          selectedTime={selectedTime}
          state={availability}
          whatsappUrl={whatsappUrl}
        />
      </div>
    </Modal>
  );
}
