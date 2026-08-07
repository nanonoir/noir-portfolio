"use client";

import { createPortal } from "react-dom";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button, Modal } from "@/components/ui";
import { DateTimeModal } from "./date-time-modal";
import { MeetingError } from "./meeting-error";
import { MeetingModalForm } from "./meeting-modal-form";
import { useMeetingModalLifecycle, type MeetingModalOrigin } from "./meeting-modal-hooks";
import { MeetingSuccess } from "./meeting-success";
import { scrollToFirstError } from "./service-form-fields";
import type { ServiceRequestTarget } from "./service-request-modal";
import type { ServiceRequestValues } from "./whatsapp-link";

type MeetingModalProps = {
  closeLabel?: string;
  dictionary: Dictionary;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onComplete?: () => void;
  origin?: MeetingModalOrigin;
  previousValues?: ServiceRequestValues | null;
  service?: ServiceRequestTarget | null;
};

export function MeetingModal({
  closeLabel,
  dictionary,
  isOpen,
  language,
  onClose,
  onComplete,
  origin = "contact",
  previousValues,
  service,
}: MeetingModalProps) {
  const lifecycle = useMeetingModalLifecycle({
    dictionary,
    language,
    onClose,
    onComplete,
    origin,
    previousValues,
    service,
  });
  const formId = lifecycle.isContactOrigin ? "meeting-contact-form" : "meeting-service-form";
  const isSubmitting = lifecycle.step === "loading";
  const footer = lifecycle.step === "form" ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      <Button className="hidden md:inline-flex" variant="outlined" onClick={lifecycle.handleClose}>{dictionary.meeting.actions.close}</Button>
      <Button disabled={isSubmitting} form={formId} type="submit">{dictionary.meeting.actions.confirm}</Button>
    </div>
  ) : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <Modal closeLabel={closeLabel || dictionary.modals.closeLabel} footer={footer} isOpen={isOpen} onClose={lifecycle.handleDismiss} size="lg" title={dictionary.meeting.title}>
        {lifecycle.step === "success" ? (
          <MeetingSuccess dictionary={dictionary} onClose={lifecycle.handleSuccessClose} whatsappUrl={lifecycle.isContactOrigin ? undefined : lifecycle.whatsAppUrl} />
        ) : lifecycle.step === "error" ? (
          <MeetingError code={lifecycle.submitError?.code} dictionary={dictionary} message={lifecycle.submitError?.message} onBackToForm={lifecycle.handleBackToForm} onRetry={lifecycle.handleRetry} whatsappMessage={lifecycle.isContactOrigin ? dictionary.meeting.whatsapp.intro : lifecycle.whatsAppMessage} />
        ) : (
          <MeetingModalForm
            dictionary={dictionary}
            form={lifecycle.form}
            formId={formId}
            isContactOrigin={lifecycle.isContactOrigin}
            isLoading={lifecycle.step === "loading"}
            onOpenDateTime={() => lifecycle.setDateTimeOpen(true)}
            onSubmit={lifecycle.form.handleSubmit(lifecycle.handleSubmit, scrollToFirstError)}
            selectedDate={lifecycle.selectedDate}
            selectedTime={lifecycle.selectedTime}
          />
        )}
      </Modal>

      {lifecycle.dateTimeOpen ? (
        <DateTimeModal
          closeLabel={closeLabel || dictionary.modals.closeLabel}
          dictionary={dictionary}
          initialDate={lifecycle.selectedDate}
          initialTime={lifecycle.selectedTime}
          isOpen={lifecycle.dateTimeOpen}
          language={language}
          onClose={() => lifecycle.setDateTimeOpen(false)}
          onConfirm={lifecycle.handleDateTimeConfirm}
          whatsappUrl={lifecycle.whatsAppUrl}
        />
      ) : null}
    </>,
    document.body,
  );
}
