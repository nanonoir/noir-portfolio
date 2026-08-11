"use client";

import { createContext, useContext, useId, useMemo, useState } from "react";

type AccordionContextValue = {
  openValue: string | null;
  setOpenValue: (value: string | null) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

type AccordionProps = {
  children: React.ReactNode;
  defaultValue?: string;
};

export function Accordion({ children, defaultValue }: AccordionProps) {
  const [openValue, setOpenValue] = useState<string | null>(defaultValue ?? null);
  const value = useMemo(() => ({ openValue, setOpenValue }), [openValue]);

  return <AccordionContext.Provider value={value}>{children}</AccordionContext.Provider>;
}

type AccordionItemProps = {
  children: React.ReactNode;
  title: string;
  value: string;
};

export function AccordionItem({ children, title, value }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  const generatedId = useId();

  if (!context) {
    throw new Error("AccordionItem must be used inside Accordion.");
  }

  const isOpen = context.openValue === value;
  const triggerId = `${generatedId}-trigger`;
  const panelId = `${generatedId}-panel`;

  return (
    <div className="border-b border-border last:border-b-0">
      <h3>
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          id={triggerId}
          onClick={() => context.setOpenValue(isOpen ? null : value)}
          type="button"
        >
          <span>{title}</span>
          <span aria-hidden="true" className="text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
        </button>
      </h3>
      <div
        aria-labelledby={triggerId}
        hidden={!isOpen}
        id={panelId}
        role="region"
      >
        <div className="pb-4 text-sm leading-6 text-body-foreground">{children}</div>
      </div>
    </div>
  );
}
