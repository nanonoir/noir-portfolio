import type { HTMLAttributes, ReactNode, Ref } from "react";

type SectionShellProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  contained?: boolean;
  ref?: Ref<HTMLElement>;
};

export function SectionShell({
  children,
  className,
  contained = true,
  ref,
  ...props
}: SectionShellProps) {
  return (
    <section
      className={["px-6 py-24 lg:py-32", className].filter(Boolean).join(" ")}
      ref={ref}
      {...props}
    >
      {contained ? <div className="mx-auto max-w-6xl">{children}</div> : children}
    </section>
  );
}
