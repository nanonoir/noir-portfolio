"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { contactLinks } from "@/data/content";
import { ACTION_FORM_ACTIONS, type ActionFormAction } from "@/lib/meet/action-contract";
import { ActionResultCard, ACTION_RESULT_VARIANTS } from "./action-result-card";
import { useActionToken } from "./use-action-token";

const ACTION_FORM_STATES = {
  IDLE: "idle",
  LINK_NOT_ACTIVE: "linkNotActive",
  REPLAY: "replay",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  WARNING: "warning",
  UNAVAILABLE: "unavailable",
} as const;

type ActionFormState = (typeof ACTION_FORM_STATES)[keyof typeof ACTION_FORM_STATES];

type ActionFormProps = {
  action: ActionFormAction;
  allowReason?: boolean;
  description: string;
  dictionary: Dictionary;
  meetingId: string;
  submitLabel: string;
};

type ActionResponse = {
  error?: string;
  reason?: string;
  status?: "ok" | "replayed";
  success?: boolean;
  emailDeliveryStatus?: "pending" | "completed" | "failed";
  calendarDeliveryStatus?: "pending" | "completed" | "failed";
};

function getResultState(action: ActionFormAction, response: ActionResponse): ActionFormState {
  const calendarDeliveryNeedsAttention = response.calendarDeliveryStatus === "failed"
    || (
      response.calendarDeliveryStatus === "pending"
      && (action === ACTION_FORM_ACTIONS.CONFIRM || action === ACTION_FORM_ACTIONS.ACCEPT_PROPOSAL)
    );
  if (response.success && (
    response.emailDeliveryStatus === "failed"
    || response.emailDeliveryStatus === "pending"
    || calendarDeliveryNeedsAttention
  )) return ACTION_FORM_STATES.WARNING;
  if (response.success && response.status === "replayed") return ACTION_FORM_STATES.REPLAY;
  if (response.success) return ACTION_FORM_STATES.SUCCESS;
  if (response.reason === "not_found" || response.error === "LINK_NOT_ACTIVE") return ACTION_FORM_STATES.LINK_NOT_ACTIVE;
  return ACTION_FORM_STATES.UNAVAILABLE;
}

export function ActionForm({ action, allowReason = false, description, dictionary, meetingId, submitLabel }: ActionFormProps) {
  const { hasToken, isReady: tokenReady, token } = useActionToken();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionFormState>(ACTION_FORM_STATES.IDLE);
  const isSubmitting = state === ACTION_FORM_STATES.SUBMITTING;
  const terminalState = state === ACTION_FORM_STATES.SUCCESS
    || state === ACTION_FORM_STATES.REPLAY
    || state === ACTION_FORM_STATES.WARNING
    || state === ACTION_FORM_STATES.LINK_NOT_ACTIVE
    || (action === ACTION_FORM_ACTIONS.DECLINE && state === ACTION_FORM_STATES.UNAVAILABLE);

  async function handleSubmit() {
    if (!hasToken || isSubmitting) return;

    setState(ACTION_FORM_STATES.SUBMITTING);

    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/${action}`, {
        body: JSON.stringify({ ...(allowReason && reason.trim() ? { reason: reason.trim() } : {}), token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json() as ActionResponse;
      setState(getResultState(action, data));
    } catch {
      setState(ACTION_FORM_STATES.UNAVAILABLE);
    }
  }

  if (terminalState) {
    const replay = state === ACTION_FORM_STATES.REPLAY;
    const deliveryWarning = state === ACTION_FORM_STATES.WARNING;
    const declineUnavailable = action === ACTION_FORM_ACTIONS.DECLINE && state === ACTION_FORM_STATES.UNAVAILABLE;
    return (
      <ActionResultCard
        message={replay ? dictionary.meet.action.actionReplayDescription : deliveryWarning ? dictionary.meet.action.actionDeliveryWarningDescription : state === ACTION_FORM_STATES.SUCCESS ? dictionary.meet.action.actionSuccessDescription : declineUnavailable ? dictionary.meet.action.actionTemporarilyUnavailable : dictionary.meet.action.proposalLinkNotActive}
        title={replay ? dictionary.meet.action.replay : deliveryWarning ? dictionary.meet.action.deliveryWarning : state === ACTION_FORM_STATES.SUCCESS ? dictionary.meet.action.success : declineUnavailable ? dictionary.meet.action.unavailable : dictionary.meet.action.invalid}
        variant={replay ? ACTION_RESULT_VARIANTS.INFO : deliveryWarning ? ACTION_RESULT_VARIANTS.WARNING : state === ACTION_FORM_STATES.SUCCESS ? ACTION_RESULT_VARIANTS.SUCCESS : ACTION_RESULT_VARIANTS.ERROR}
      >
        {declineUnavailable ? (
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
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{description}</p>
      {tokenReady && !hasToken ? <ActionResultCard message={dictionary.meet.action.proposalLinkNotActive} title={dictionary.meet.action.invalid} variant={ACTION_RESULT_VARIANTS.ERROR} /> : null}
      {state === ACTION_FORM_STATES.UNAVAILABLE ? (
        <ActionResultCard message={dictionary.meet.action.actionTemporarilyUnavailable} title={dictionary.meet.action.unavailable} variant={ACTION_RESULT_VARIANTS.ERROR}>
          <a
            className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-5 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
            href={contactLinks.whatsApp}
            rel="noreferrer"
            target="_blank"
          >
            {dictionary.meeting.actions.whatsapp}
          </a>
        </ActionResultCard>
      ) : null}
      {allowReason ? (
        <div className="space-y-2">
          <label className="text-base font-medium text-foreground md:text-sm" htmlFor="decline-reason">{dictionary.meet.action.declineReasonLabel}</label>
          <p className="text-base text-muted-foreground md:text-sm" id="decline-reason-hint">{dictionary.meet.action.declineReasonHint}</p>
          <textarea
            aria-describedby="decline-reason-hint"
            className="min-h-28 w-full rounded-2xl border border-border bg-surface/30 px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:text-sm"
            id="decline-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
      <Button
        className={allowReason ? "bg-red-600 text-white hover:bg-red-700" : undefined}
        disabled={!hasToken || isSubmitting}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? dictionary.meet.action.submitting : submitLabel}
      </Button>
    </div>
  );
}
