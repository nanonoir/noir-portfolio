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
        "section-heading-rhythm grid lg:grid-cols-[0.9fr_1fr] lg:items-end",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        {label ? (
          <p className="mono mb-5 text-[11px] leading-[1.4] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
        ) : null}
        <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-foreground lg:text-[3.25rem] lg:leading-[1.05]">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="max-w-[65ch] text-base leading-7 text-body-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
