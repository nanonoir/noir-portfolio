import type { ReactNode } from "react";

export const ACTION_RESULT_VARIANTS = {
  ERROR: "error",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
} as const;

export type ActionResultVariant = (typeof ACTION_RESULT_VARIANTS)[keyof typeof ACTION_RESULT_VARIANTS];

type ActionResultCardProps = {
  children?: ReactNode;
  message: string;
  title: string;
  variant: ActionResultVariant;
};

const variantClasses: Record<ActionResultVariant, string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-500",
  info: "border-border bg-surface/30 text-body-foreground",
  success: "border-foreground/30 bg-surface/40 text-foreground",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export function ActionResultCard({ children, message, title, variant }: ActionResultCardProps) {
  const isError = variant === ACTION_RESULT_VARIANTS.ERROR;

  return (
    <section aria-live={isError ? "assertive" : "polite"} className={`rounded-2xl border p-5 ${variantClasses[variant]}`} role={isError ? "alert" : "status"}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-base leading-7 md:text-sm md:leading-6">{message}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
