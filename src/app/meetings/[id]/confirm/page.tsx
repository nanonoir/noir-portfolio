import { ActionPage } from "@/components/meet/action-page";
import { ACTION_FORM_ACTIONS } from "@/lib/meet/action-contract";
import { meetActionPageMetadata } from "@/components/meet/action-shell";

export const metadata = meetActionPageMetadata;

export default async function ConfirmMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActionPage action={ACTION_FORM_ACTIONS.CONFIRM} meetingId={id} />;
}
