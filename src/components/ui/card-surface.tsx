import type { HTMLAttributes, ReactNode } from "react";

type CardSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function CardSurface({ children, className, ...props }: CardSurfaceProps) {
  return (
    <div
      className={[
        "rounded-[20px] border border-border bg-card p-6 transition-colors hover:border-border-strong",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
