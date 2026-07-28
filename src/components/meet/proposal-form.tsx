"use client";

import { useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { AvailabilityCalendar, type AvailabilityCalendarSelection } from "@/components/forms/availability-calendar";
import { getVisitorTimeZone, isValidTimeZone } from "@/components/forms/date-time-constants";
import { contactLinks } from "@/data/content";
import { ACTION_FORM_ACTIONS } from "@/lib/meet/action-contract";
import { ActionResultCard, ACTION_RESULT_VARIANTS } from "./action-result-card";
import { useActionToken } from "./use-action-token";

const PROPOSAL_FORM_STATES = {
  IDLE: "idle",
  INVALID: "invalid",
  LINK_NOT_ACTIVE: "linkNotActive",
  REPLAY: "replay",
  SLOT_UNAVAILABLE: "slotUnavailable",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  UNAVAILABLE: "unavailable",
  WARNING: "warning",
} as const;

type ProposalFormState = (typeof PROPOSAL_FORM_STATES)[keyof typeof PROPOSAL_FORM_STATES];

type ProposalActionResponse = {
  error?: string;
  reason?: string;
  status?: "ok" | "replayed";
  success?: boolean;
  emailDeliveryStatus?: "pending" | "completed" | "failed";
};

type ProposalFormProps = {
  dictionary: Dictionary;
  language: Language;
  meetingId: string;
};

function resolveVisitorTimeZone() {
  try {
    const timeZone = getVisitorTimeZone();
    return isValidTimeZone(timeZone) ? timeZone : "";
  } catch {
    return "";
  }
}

function responseState(response: ProposalActionResponse): ProposalFormState {
  if (response.success && (response.emailDeliveryStatus === "failed" || response.emailDeliveryStatus === "pending")) return PROPOSAL_FORM_STATES.WARNING;
  if (response.success && response.status === "replayed") return PROPOSAL_FORM_STATES.REPLAY;
  if (response.success) return PROPOSAL_FORM_STATES.SUCCESS;
  if (response.reason === "slot_unavailable" || response.error === "SLOT_UNAVAILABLE") return PROPOSAL_FORM_STATES.SLOT_UNAVAILABLE;
  if (response.reason === "invalid_payload" || response.error === "INVALID_PAYLOAD") return PROPOSAL_FORM_STATES.INVALID;
  if (response.reason === "not_found" || response.error === "LINK_NOT_ACTIVE") return PROPOSAL_FORM_STATES.LINK_NOT_ACTIVE;
  return PROPOSAL_FORM_STATES.UNAVAILABLE;
}

function stateCard(dictionary: Dictionary, state: ProposalFormState) {
  switch (state) {
    case PROPOSAL_FORM_STATES.SUCCESS:
      return { message: dictionary.meet.action.proposalSuccessDescription, title: dictionary.meet.action.success, variant: ACTION_RESULT_VARIANTS.SUCCESS };
    case PROPOSAL_FORM_STATES.REPLAY:
      return { message: dictionary.meet.action.proposalReplayDescription, title: dictionary.meet.action.replay, variant: ACTION_RESULT_VARIANTS.INFO };
    case PROPOSAL_FORM_STATES.WARNING:
      return { message: dictionary.meet.action.proposalDeliveryWarningDescription, title: dictionary.meet.action.deliveryWarning, variant: ACTION_RESULT_VARIANTS.WARNING };
    case PROPOSAL_FORM_STATES.SLOT_UNAVAILABLE:
      return { message: dictionary.meet.action.proposalSlotUnavailable, title: dictionary.meet.action.unavailable, variant: ACTION_RESULT_VARIANTS.ERROR };
    case PROPOSAL_FORM_STATES.INVALID:
      return { message: dictionary.meet.action.proposalInvalid, title: dictionary.meet.action.error, variant: ACTION_RESULT_VARIANTS.ERROR };
    case PROPOSAL_FORM_STATES.LINK_NOT_ACTIVE:
      return { message: dictionary.meet.action.proposalLinkNotActive, title: dictionary.meet.action.invalid, variant: ACTION_RESULT_VARIANTS.ERROR };
    default:
      return { message: dictionary.meet.action.proposalTemporarilyUnavailable, title: dictionary.meet.action.unavailable, variant: ACTION_RESULT_VARIANTS.ERROR };
  }
}

export function ProposalForm({ dictionary, language, meetingId }: ProposalFormProps) {
  const { hasToken, isReady: tokenReady, token } = useActionToken();
  const [selection, setSelection] = useState<AvailabilityCalendarSelection>({ date: "", time: "" });
  const [availabilityStatus, setAvailabilityStatus] = useState("idle");
  const [state, setState] = useState<ProposalFormState>(PROPOSAL_FORM_STATES.IDLE);
  const [timeZone] = useState(resolveVisitorTimeZone);
  const timezoneUnavailable = !timeZone;
  const selectedSlotUnverified = selection.availabilityStatus === "unverified";
  const isSubmitting = state === PROPOSAL_FORM_STATES.SUBMITTING;
  const canSubmit = Boolean(
    hasToken
    && selection.date
    && selection.time
    && availabilityStatus === "success"
    && !selectedSlotUnverified
    && !timezoneUnavailable
    && !isSubmitting,
  );
  const terminalStates: ProposalFormState[] = [
    PROPOSAL_FORM_STATES.SUCCESS,
    PROPOSAL_FORM_STATES.REPLAY,
    PROPOSAL_FORM_STATES.WARNING,
    PROPOSAL_FORM_STATES.LINK_NOT_ACTIVE,
  ];
  const terminalState = terminalStates.includes(state);

  function handleSelect(selectionValue: AvailabilityCalendarSelection) {
    setSelection(selectionValue);
    if (!terminalState) {
      setState(PROPOSAL_FORM_STATES.IDLE);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setState(PROPOSAL_FORM_STATES.SUBMITTING);

    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/${ACTION_FORM_ACTIONS.PROPOSE}`, {
        body: JSON.stringify({
          proposedSlot: {
            date: selection.date,
            time: selection.time,
            visitorTimezone: timeZone,
          },
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json() as ProposalActionResponse;

      setState(responseState(data));
    } catch {
      setState(PROPOSAL_FORM_STATES.UNAVAILABLE);
    }
  }

  if (terminalState) {
    const card = stateCard(dictionary, state);
    return <ActionResultCard {...card} />;
  }

  const errorState = state !== PROPOSAL_FORM_STATES.IDLE && state !== PROPOSAL_FORM_STATES.SUBMITTING;
  const card = errorState ? stateCard(dictionary, state) : null;

  return (
    <div className="space-y-6">
      <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{dictionary.meet.action.proposalDescription}</p>
      {timezoneUnavailable ? <ActionResultCard message={dictionary.forms.errors.timezoneRequired} title={dictionary.meet.action.error} variant={ACTION_RESULT_VARIANTS.ERROR} /> : null}
      {tokenReady && !hasToken ? <ActionResultCard message={dictionary.meet.action.proposalLinkNotActive} title={dictionary.meet.action.invalid} variant={ACTION_RESULT_VARIANTS.ERROR} /> : null}
      {selectedSlotUnverified ? <ActionResultCard message={dictionary.meet.action.proposalSlotUnverified} title={dictionary.meet.action.unavailable} variant={ACTION_RESULT_VARIANTS.INFO} /> : null}
      {card ? (
        <ActionResultCard {...card}>
          {state === PROPOSAL_FORM_STATES.UNAVAILABLE ? (
            <a
              className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-5 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
              href={contactLinks.whatsApp}
              rel="noreferrer"
              target="_blank"
            >
              {dictionary.meeting.actions.whatsapp}
            </a>
          ) : null}
        </ActionResultCard>
      ) : null}
      <AvailabilityCalendar
        dictionary={dictionary}
        language={language}
        onAvailabilityStatusChange={setAvailabilityStatus}
        onSelectTime={handleSelect}
        selectedDate={selection.date}
        selectedTime={selection.time}
        timeZone={timeZone || "UTC"}
        whatsappUrl={contactLinks.whatsApp}
      />
      <section aria-live="polite" className="rounded-2xl border border-border bg-surface/20 p-4">
        <h2 className="text-base font-medium text-foreground md:text-sm">{dictionary.meet.action.proposalSelectedSlot}</h2>
        <p className="mt-1 text-base text-body-foreground md:text-sm">
          {selection.date && selection.time ? `${selection.date} · ${selection.time} · ${timeZone}` : dictionary.meet.action.proposalSelectSlot}
        </p>
      </section>
      <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
        {isSubmitting ? dictionary.meet.action.submitting : dictionary.meet.action.submit}
      </Button>
    </div>
  );
}
