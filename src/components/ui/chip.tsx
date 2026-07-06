import type { HTMLAttributes, ReactNode } from "react";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  size?: "sm" | "md";
};

export function Chip({ children, className, size = "md", ...props }: ChipProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={[
        "mono inline-flex items-center rounded-full border border-border bg-surface text-foreground/80 transition-colors",
        sizeClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
