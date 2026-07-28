import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n";

export const MEET_ACTION_SHELL_STATES = {
  CONFIRM: "confirm",
  PROPOSE: "propose",
  DECLINE: "decline",
  ACCEPT_PROPOSAL: "acceptProposal",
  INVALID: "invalid",
  EXPIRED: "expired",
  UNAVAILABLE: "unavailable",
  SUCCESS: "success",
  REPLAY: "replay",
  ERROR: "error",
} as const;

export type MeetActionShellState = (typeof MEET_ACTION_SHELL_STATES)[keyof typeof MEET_ACTION_SHELL_STATES];

export const meetActionPageMetadata: Metadata = {
  title: "Meeting action",
  robots: {
    follow: false,
    index: false,
  },
};

type ActionShellProps = {
  children: ReactNode;
  dictionary: Dictionary;
  primaryAction?: ReactNode;
  state: MeetActionShellState;
};

export function ActionShell({ children, dictionary, primaryAction, state }: ActionShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
      <meta content="noindex,nofollow" name="robots" />
      <section aria-labelledby="meet-action-title" className="w-full max-w-xl rounded-[20px] border border-border bg-card p-6 shadow-pill sm:p-8">
        <span className="inline-flex text-sm font-medium tracking-tight text-foreground">
          {dictionary.meta.siteName}
        </span>
        <div className="mt-8 space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" id="meet-action-title">
            {dictionary.meet.action[state]}
          </h1>
          <div className="text-base leading-7 text-body-foreground md:text-sm md:leading-6">{children}</div>
        </div>
        {primaryAction ? <div className="mt-8 border-t border-border pt-6">{primaryAction}</div> : null}
        <footer className="mt-8 border-t border-border pt-5">
          <span className="text-sm text-muted-foreground">{dictionary.meta.siteName}</span>
        </footer>
      </section>
    </main>
  );
}
