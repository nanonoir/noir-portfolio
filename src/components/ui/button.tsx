import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outlined" | "ghost" | "nav" | "language" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const baseClasses =
  "button-feedback inline-flex items-center justify-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "button-primary bg-primary px-6 py-3 text-sm font-medium text-primary-foreground",
  outlined:
    "button-outlined border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground",
  ghost:
    "button-ghost px-3 py-1.5 text-sm text-foreground",
  nav: "button-nav px-3 py-1.5 text-sm text-muted-foreground",
  language:
    "button-language mono px-2.5 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground",
  icon: "button-icon button-icon-feedback size-8 p-0 text-muted-foreground",
};

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const hasExplicitDisplayClass = Boolean(
    className && /\b(hidden|block|inline-block|flex|inline-flex|grid|inline-grid)\b/.test(className),
  );

  return (
    <button
      className={[
        hasExplicitDisplayClass ? baseClasses.replace("inline-flex ", "") : baseClasses,
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
