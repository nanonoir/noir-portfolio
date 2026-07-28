"use client";

import { useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, Modal } from "@/components/ui";
import { AvailabilityCalendar, type AvailabilityCalendarSelection } from "./availability-calendar";
import {
  getVisitorTimeZone,
  isDateWithinAvailabilityRules,
} from "./date-time-constants";

type DateTimeModalProps = {
  closeLabel: string;
  dictionary: Dictionary;
  initialDate: string;
  initialTime: string;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onConfirm: (selection: AvailabilityCalendarSelection) => void;
  whatsappUrl: string;
};

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
  const [selection, setSelection] = useState<AvailabilityCalendarSelection>({
    date: initialSelectedDate,
    time: initialSelectedDate ? initialTime : "",
  });
  const [availabilityStatus, setAvailabilityStatus] = useState(initialSelectedDate ? "loading" : "idle");
  const canConfirm = Boolean(selection.date && selection.time && availabilityStatus === "success");

  return (
    <Modal
      closeLabel={closeLabel}
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button className="hidden md:inline-flex" variant="outlined" onClick={onClose}>{dictionary.meeting.dateTime.cancel}</Button>
          <Button disabled={!canConfirm} onClick={() => onConfirm(selection)}>
            {dictionary.meeting.dateTime.confirm}
          </Button>
        </div>
      )}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={dictionary.meeting.dateTime.title}
    >
      <AvailabilityCalendar
        dictionary={dictionary}
        language={language}
        onAvailabilityStatusChange={setAvailabilityStatus}
        onSelectTime={setSelection}
        selectedDate={selection.date}
        selectedTime={selection.time}
        timeZone={timeZone}
        whatsappUrl={whatsappUrl}
      />
    </Modal>
  );
}
