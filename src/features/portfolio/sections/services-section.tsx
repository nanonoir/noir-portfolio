"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { createCustomServiceRequestTarget, type ServiceRequestTarget } from "@/features/service-request/components/service-request-modal";
import { useLanguage } from "@/components/providers/language-provider";
import { Button, CardSurface, HandwrittenIcon, SectionHeading, SectionShell, ServiceInfoModal } from "@/components/ui";
import { services, type Service } from "@/data/content";

const ServiceRequestModal = dynamic(
  () => import("@/features/service-request/components/service-request-modal").then((m) => ({ default: m.ServiceRequestModal })),
  { ssr: false },
);

function preloadServiceRequestModal() {
  void import("@/features/service-request/components/service-request-modal");
}

const SERVICE_ICON_BY_ID = {
  automation: "automation",
  ecommerce: "store",
  landing: "landing",
  "web-audit": "audit",
} as const;

export function ServicesSection() {
  const { dictionary, language } = useLanguage();
  const t = dictionary.services;
  const [infoService, setInfoService] = useState<Service | null>(null);
  const [requestService, setRequestService] = useState<ServiceRequestTarget | null>(null);
  const [isHandingOffRequest, setIsHandingOffRequest] = useState(false);
  const customService = createCustomServiceRequestTarget(t.customTitle, t.customDescription);

  function handleRequestFromInfo(service: Service) {
    setIsHandingOffRequest(true);
    setInfoService(null);
    setRequestService(service);
  }

  return (
    <SectionShell className="hairline-t hairline-b" id="services">
      <SectionHeading
        description={t.description}
        label={t.label}
        title={t.title}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <CardSurface className="service-card group flex min-h-72 flex-col" key={service.id}>
            <span className="grid size-10 place-items-center rounded-2xl border border-border bg-surface transition-colors group-hover:bg-foreground group-hover:text-background">
              <HandwrittenIcon
                className="size-5"
                icon={SERVICE_ICON_BY_ID[service.id]}
                size={20}
              />
            </span>
            <h3 className="mt-6 text-base font-semibold tracking-[-0.01em] text-foreground">
              {service.title[language]}
            </h3>
            <p className="mt-4 flex-1 text-sm leading-6 text-body-foreground">
              {service.description[language]}
            </p>
            <p className="service-outcome mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
              <HandwrittenIcon
                className="mt-0.5 size-4 shrink-0"
                icon={
                  service.id === "web-audit"
                    ? "valueAudit"
                    : service.id === "landing"
                      ? "valueLanding"
                      : service.id === "ecommerce"
                        ? "valueEcommerce"
                        : "valueAutomation"
                }
              />
              {service.details.result[language]}
            </p>
            <div className="hairline-t mt-6 pt-4 flex items-center justify-between gap-4">
              <Button
                icon={<HandwrittenIcon className="size-3.5" fallbackSrc="about" size={14} />}
                iconPosition="start"
                label={t.moreInfo}
                onClick={() => {
                  setIsHandingOffRequest(false);
                  setInfoService(service);
                }}
                size="sm"
                variant="ghost"
              />
              <Button
                icon={<HandwrittenIcon className="size-3.5" fallbackSrc="request" size={14} />}
                label={t.request}
                onClick={() => setRequestService(service)}
                onFocus={preloadServiceRequestModal}
                onMouseEnter={preloadServiceRequestModal}
                size="sm"
                variant="ghost"
              />
            </div>
          </CardSurface>
        ))}
      </div>
      <div className="mt-6 grid gap-6 rounded-[20px] border border-border bg-foreground px-6 py-6 md:grid-cols-[1fr_auto] md:items-center dark:border-border-strong">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-background">
            {t.customTitle}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-background/70">
            {t.customDescription}
          </p>
        </div>
        <Button
          className="w-full md:w-auto"
          icon={<HandwrittenIcon className="size-3.5" fallbackSrc="request" size={14} />}
          label={t.request}
          onClick={() => setRequestService(customService)}
          onFocus={preloadServiceRequestModal}
          onMouseEnter={preloadServiceRequestModal}
          variant="inverse"
        />
      </div>
      <ServiceInfoModal
        closeLabel={dictionary.modals.closeLabel}
        isOpen={Boolean(infoService)}
        language={language}
        onClose={() => setInfoService(null)}
        onRequest={handleRequestFromInfo}
        restoreFocus={!isHandingOffRequest}
        service={infoService}
      />
      {requestService ? (
        <ServiceRequestModal
          closeLabel={dictionary.modals.closeLabel}
          dictionary={dictionary}
          isOpen={Boolean(requestService)}
          key={requestService.id}
          language={language}
          onClose={() => setRequestService(null)}
          service={requestService}
        />
      ) : null}
    </SectionShell>
  );
}
