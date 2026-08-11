"use client";

import Image from "next/image";
import { HandwrittenIcon } from "./handwritten-icon";
import { Modal } from "./modal";

export type DocumentConfig = {
  title: string;
  hideTitle?: boolean;
  previewSrc?: string;
  /** PDF URL for the iframe viewer. Falls back to downloadHref when omitted. */
  pdfSrc?: string;
  downloadHref?: string;
  downloadLabel?: string;
  openLabel?: string;
};

type PdfModalProps = {
  closeLabel: string;
  config: DocumentConfig;
  isOpen: boolean;
  onClose: () => void;
};

export function PdfModal({ closeLabel, config, isOpen, onClose }: PdfModalProps) {
  const { title, hideTitle, previewSrc, pdfSrc, downloadHref, downloadLabel, openLabel } = config;

  const iframeSrc = pdfSrc ?? downloadHref;

  const headerActions =
    downloadHref ? (
      <div className="flex shrink-0 items-center gap-2">
        <a
          aria-label={downloadLabel}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          download
          href={downloadHref}
        >
          <HandwrittenIcon className="size-4 shrink-0" icon="download" />
          {downloadLabel}
        </a>

        {openLabel ? (
          <a
            aria-label={openLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            href={downloadHref}
            rel="noreferrer"
            target="_blank"
          >
            {openLabel}
            <HandwrittenIcon className="size-4 shrink-0" icon="request" />
          </a>
        ) : null}
      </div>
    ) : undefined;

  return (
    <Modal
      closeLabel={closeLabel}
      headerActions={headerActions}
      hideTitle={hideTitle}
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={title}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {previewSrc ? (
          <div aria-hidden="true" className="relative md:hidden">
            <Image
              alt={title}
              className="h-auto w-full object-contain"
              height={900}
              src={previewSrc}
              width={700}
            />
          </div>
        ) : null}
        {iframeSrc ? (
          <iframe
            className={`h-[72vh] w-full ${previewSrc ? "hidden md:block" : ""}`}
            src={iframeSrc}
            title={title}
          />
        ) : null}
      </div>
    </Modal>
  );
}
