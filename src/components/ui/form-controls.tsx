import type { InputHTMLAttributes, ReactNode } from "react";

type LabelProps = {
  children: ReactNode;
  htmlFor: string;
  required?: boolean;
};

export function Label({ children, htmlFor, required = false }: LabelProps) {
  return (
    <label className="text-base font-medium text-foreground md:text-sm" htmlFor={htmlFor}>
      {children}
      {required ? <span className="ml-1 text-muted-foreground" aria-hidden="true">*</span> : null}
    </label>
  );
}

type FormErrorProps = {
  children?: ReactNode;
  id?: string;
};

export function FormError({ children, id }: FormErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-base text-red-500 md:text-sm" id={id} role="alert">
      {children}
    </p>
  );
}

type RadioProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
};

export function Radio({ className, label, ...props }: RadioProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface/30 px-4 py-3 text-base text-body-foreground transition-colors hover:bg-surface/60 has-[:checked]:border-foreground/50 has-[:checked]:bg-foreground/5 md:text-sm">
      <input
        className={["size-4 accent-foreground", className].filter(Boolean).join(" ")}
        type="radio"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
