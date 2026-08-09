import { ActionPage } from "@/features/meeting/components/booking-actions/action-page";
import { ACTION_FORM_ACTIONS } from "@/lib/meet/action-contract";
import { meetActionPageMetadata } from "@/features/meeting/components/booking-actions/action-shell";

export const metadata = meetActionPageMetadata;

export default async function DeclineMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActionPage action={ACTION_FORM_ACTIONS.DECLINE} meetingId={id} />;
}
