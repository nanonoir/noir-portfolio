"use client";

import type { Language } from "@/lib/i18n";
import type { Service } from "@/data/content";
import { Accordion, AccordionItem } from "./accordion";
import { Button } from "./button";
import { Modal } from "./modal";

type ServiceInfoModalProps = {
  closeLabel: string;
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onRequest: (service: Service) => void;
  service: Service | null;
};

function LocalizedList({ items, language }: { items: Service["details"]["reviewIncludes"]; language: Language }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li className="flex gap-2" key={item[language]}>
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <span>{item[language]}</span>
        </li>
      ))}
    </ul>
  );
}

export function ServiceInfoModal({
  closeLabel,
  isOpen,
  language,
  onClose,
  onRequest,
  service,
}: ServiceInfoModalProps) {
  if (!service) {
    return null;
  }

  const details = service.details;
  const idealForTitle = language === "es" ? "Ideal para" : "Ideal for";
  const resultTitle = language === "es" ? "Resultado" : "Result";

  function handleRequest() {
    if (!service) {
      return;
    }

    onRequest(service);
  }

  return (
    <Modal
      closeLabel={closeLabel}
      footer={<Button onClick={handleRequest}>{details.ctaLabel[language]}</Button>}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={service.title[language]}
    >
      <div className="space-y-5">
        <div className="space-y-3 text-sm leading-6 text-body-foreground">
          {details.intro.map((paragraph) => (
            <p key={paragraph[language]}>{paragraph[language]}</p>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-surface/50 p-4">
          <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{idealForTitle}</p>
          <p className="mt-2 text-sm leading-6 text-body-foreground">{details.idealFor[language]}</p>
        </div>

        <Accordion>
          <AccordionItem title={details.reviewTitle[language]} value="review-includes">
            <LocalizedList items={details.reviewIncludes} language={language} />
          </AccordionItem>
          <AccordionItem title={details.deliverablesTitle[language]} value="deliverables">
            <LocalizedList items={details.deliverables} language={language} />
          </AccordionItem>
          {details.examples?.length ? (
            <AccordionItem title={details.examplesTitle?.[language] ?? (language === "es" ? "Ejemplos" : "Examples")} value="examples">
              <LocalizedList items={details.examples} language={language} />
            </AccordionItem>
          ) : null}
          {details.expandableScope?.length ? (
            <AccordionItem title={details.expandableScopeTitle?.[language] ?? (language === "es" ? "Alcance ampliable" : "Expandable scope")} value="expandable-scope">
              <LocalizedList items={details.expandableScope} language={language} />
            </AccordionItem>
          ) : null}
        </Accordion>

        <div className="rounded-2xl border border-border bg-surface/50 p-4">
          <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{resultTitle}</p>
          <p className="mt-2 text-sm leading-6 text-body-foreground">{details.result[language]}</p>
        </div>
      </div>
    </Modal>
  );
}
