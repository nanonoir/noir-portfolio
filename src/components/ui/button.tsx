import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export const ACTION_VARIANTS = {
  PRIMARY: "primary",
  DANGER: "danger",
  OUTLINED: "outlined",
  GHOST: "ghost",
  INVERSE: "inverse",
  NAV: "nav",
  LANGUAGE: "language",
  ICON: "icon",
} as const;

export type ActionVariant = (typeof ACTION_VARIANTS)[keyof typeof ACTION_VARIANTS];

export const ACTION_SIZES = {
  SM: "sm",
  MD: "md",
  LG: "lg",
  ICON: "icon",
} as const;

export type ActionSize = (typeof ACTION_SIZES)[keyof typeof ACTION_SIZES];

export const ACTION_ICON_POSITIONS = {
  START: "start",
  END: "end",
} as const;

export type ActionIconPosition = (typeof ACTION_ICON_POSITIONS)[keyof typeof ACTION_ICON_POSITIONS];

export type SharedActionProps = {
  children?: ReactNode;
  icon?: ReactNode;
  iconPosition?: ActionIconPosition;
  label?: ReactNode;
  size?: ActionSize;
  variant?: ActionVariant;
};

export type ButtonProps = SharedActionProps & ButtonHTMLAttributes<HTMLButtonElement>;
export type ActionLinkProps = SharedActionProps & AnchorHTMLAttributes<HTMLAnchorElement>;

const baseClasses =
  "action-control button-feedback inline-flex items-center justify-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50";

const variantClasses: Record<ActionVariant, string> = {
  primary:
    "button-primary bg-primary text-sm font-medium text-primary-foreground",
  danger:
    "button-danger bg-danger text-sm font-medium text-primary-foreground",
  outlined:
    "button-outlined border border-foreground/20 text-sm font-medium text-foreground",
  ghost:
    "button-ghost text-sm text-foreground",
  inverse: "button-inverse bg-background text-sm font-medium text-foreground",
  nav: "button-nav text-sm text-muted-foreground",
  language:
    "button-language mono text-[11px] uppercase tracking-widest text-muted-foreground",
  icon: "button-icon button-icon-feedback p-0 text-muted-foreground",
};

const sizeClasses: Record<ActionSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-5 py-2.5",
  lg: "px-6 py-3",
  icon: "size-8",
};

export function getActionClassName({
  className,
  size = ACTION_SIZES.LG,
  variant = ACTION_VARIANTS.PRIMARY,
}: Pick<SharedActionProps, "size" | "variant"> & { className?: string }) {
  const hasExplicitDisplayClass = Boolean(
    className && /\b(hidden|block|inline-block|flex|inline-flex|grid|inline-grid)\b/.test(className),
  );

  return [
    hasExplicitDisplayClass ? baseClasses.replace("inline-flex ", "") : baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function ActionContent({ children, icon, iconPosition = ACTION_ICON_POSITIONS.END, label }: SharedActionProps) {
  const actionLabel = label ?? children;
  const iconSlot = icon ? <span aria-hidden="true" data-action-icon="true">{icon}</span> : null;

  return (
    <span className="relative inline-flex items-center justify-center gap-2 transition-colors">
      {iconPosition === ACTION_ICON_POSITIONS.START ? iconSlot : null}
      {actionLabel ? <span data-action-label="true">{actionLabel}</span> : null}
      {iconPosition === ACTION_ICON_POSITIONS.END ? iconSlot : null}
    </span>
  );
}

export function Button({
  children,
  className,
  icon,
  iconPosition,
  label,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={getActionClassName({ className, size, variant })}
      data-action="button"
      data-action-size={size ?? ACTION_SIZES.LG}
      data-action-variant={variant ?? ACTION_VARIANTS.PRIMARY}
      type={type}
      {...props}
    >
      <ActionContent icon={icon} iconPosition={iconPosition} label={label}>{children}</ActionContent>
    </button>
  );
}

export function ActionLink({
  children,
  className,
  icon,
  iconPosition,
  label,
  size,
  variant,
  ...props
}: ActionLinkProps) {
  return (
    <a
      className={getActionClassName({ className, size, variant })}
      data-action="link"
      data-action-size={size ?? ACTION_SIZES.LG}
      data-action-variant={variant ?? ACTION_VARIANTS.PRIMARY}
      {...props}
    >
      <ActionContent icon={icon} iconPosition={iconPosition} label={label}>{children}</ActionContent>
    </a>
  );
}
