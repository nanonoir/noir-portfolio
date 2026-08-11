import { ActionShell, meetActionPageMetadata } from "@/features/meeting/components/booking-actions/action-shell";
import { ACTION_FORM_ACTIONS } from "@/lib/meet/action-contract";
import { ProposalForm } from "@/features/meeting/components/booking-actions/proposal-form";
import { DEFAULT_LANGUAGE, getDictionary } from "@/lib/i18n";

export const metadata = meetActionPageMetadata;

export default async function ProposeMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const language = DEFAULT_LANGUAGE;
  const dictionary = getDictionary(language);

  return (
    <ActionShell dictionary={dictionary} state={ACTION_FORM_ACTIONS.PROPOSE}>
      <ProposalForm dictionary={dictionary} language={language} meetingId={id} />
    </ActionShell>
  );
}
