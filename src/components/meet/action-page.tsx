import type { Dictionary } from "@/lib/i18n";
import { DEFAULT_LANGUAGE, getDictionary } from "@/lib/i18n";
import { ACTION_FORM_ACTIONS, type ActionFormAction } from "@/lib/meet/action-contract";
import { ActionForm } from "./action-form";
import { ActionShell, MEET_ACTION_SHELL_STATES, type MeetActionShellState } from "./action-shell";

type ActionPageAction = Exclude<ActionFormAction, typeof ACTION_FORM_ACTIONS.PROPOSE>;

type ActionPageProps = {
  action: ActionPageAction;
  meetingId: string;
};

type ActionPageCopy = {
  allowReason?: boolean;
  description: (dictionary: Dictionary) => string;
  shellState: MeetActionShellState;
  submitLabel: (dictionary: Dictionary) => string;
};

const ACTION_PAGE_COPY: Record<ActionPageAction, ActionPageCopy> = {
  [ACTION_FORM_ACTIONS.CONFIRM]: {
    description: (dictionary) => dictionary.meet.action.confirmDescription,
    shellState: MEET_ACTION_SHELL_STATES.CONFIRM,
    submitLabel: (dictionary) => dictionary.meet.action.confirm,
  },
  [ACTION_FORM_ACTIONS.DECLINE]: {
    allowReason: true,
    description: (dictionary) => dictionary.meet.action.declineDescription,
    shellState: MEET_ACTION_SHELL_STATES.DECLINE,
    submitLabel: (dictionary) => dictionary.meet.action.decline,
  },
  [ACTION_FORM_ACTIONS.ACCEPT_PROPOSAL]: {
    description: (dictionary) => dictionary.meet.action.acceptProposalDescription,
    shellState: MEET_ACTION_SHELL_STATES.ACCEPT_PROPOSAL,
    submitLabel: (dictionary) => dictionary.meet.action.acceptProposal,
  },
};

export function ActionPage({ action, meetingId }: ActionPageProps) {
  const language = DEFAULT_LANGUAGE;
  const dictionary = getDictionary(language);
  const copy = ACTION_PAGE_COPY[action];

  return (
    <ActionShell dictionary={dictionary} state={copy.shellState}>
      <ActionForm
        action={action}
        allowReason={copy.allowReason}
        description={copy.description(dictionary)}
        dictionary={dictionary}
        meetingId={meetingId}
        submitLabel={copy.submitLabel(dictionary)}
      />
    </ActionShell>
  );
}
