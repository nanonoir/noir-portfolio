import type { ReactNode } from "react";

type SectionHeadingProps = {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function SectionHeading({
  className,
  description,
  label,
  title,
}: SectionHeadingProps) {
  return (
    <header
      className={[
        "mb-12 grid gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-end",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        {label ? (
          <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
        ) : null}
        <h2 className="text-4xl font-semibold tracking-[-0.03em] text-foreground lg:text-[60px] lg:leading-none">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="max-w-xl text-base leading-7 text-body-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
