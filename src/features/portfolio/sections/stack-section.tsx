"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { CardSurface, Chip, SectionHeading, SectionShell } from "@/components/ui";
import { stackCategories } from "@/data/content";
import { PortfolioTechnologyIcon } from "./portfolio-technology-icon";

export function StackSection() {
  const { dictionary, language } = useLanguage();
  const stack = dictionary.stack;

  return (
    <SectionShell className="hairline-b" id="stack">
      <SectionHeading
        description={stack.description}
        label={stack.label}
        title={stack.title}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {stackCategories.map((category, index) => (
          <CardSurface className="hover:border-border" key={category.id}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                {category.title[language]}
              </h3>
              <span className="mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {category.tools.map((tool) => (
                <Chip
                  className="gap-1.5 stack-tech-chip"
                  key={`${category.id}-${tool.name}`}
                >
                  <PortfolioTechnologyIcon
                    className="size-3.5 text-foreground"
                    name={tool.name}
                    size={14}
                  />
                  {tool.name}
                </Chip>
              ))}
            </div>
          </CardSurface>
        ))}
      </div>
    </SectionShell>
  );
}
