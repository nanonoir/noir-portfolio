import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClasses =
  "w-full rounded-2xl border border-border bg-surface/40 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/60 focus:bg-surface focus:outline-none disabled:pointer-events-none disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={[fieldClasses, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function Textarea({
  className,
  rows = 6,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={[fieldClasses, "resize-none", className].filter(Boolean).join(" ")}
      rows={rows}
      {...props}
    />
  );
}
