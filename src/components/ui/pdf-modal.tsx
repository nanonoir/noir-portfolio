"use client";

import Image from "next/image";
import { HandwrittenIcon } from "./handwritten-icon";
import { Modal } from "./modal";

// ---------------------------------------------------------------------------
// Document configuration types
// ---------------------------------------------------------------------------

/**
 * Shared document configuration consumed by both Resume and Diploma modals.
 *
 * - `title`        : accessible dialog title (always present; may be visually
 *                    hidden for Resume via `hideTitle: true`).
 * - `hideTitle`    : when true the <h2> is visually hidden (sr-only) so no
 *                    visible "Resume" heading appears in the header row.
 * - `previewSrc`   : optional static preview image (used on iOS/mobile where
 *                    the PDF iframe cannot render).
 * - `pdfSrc`       : PDF URL used as the iframe source for desktop preview.
 *                    Defaults to `downloadHref` when omitted.
 * - `downloadHref` : optional direct PDF URL for the Download header action.
 *                    When absent, no Download button is rendered.
 * - `downloadLabel`: localized label for the download button; required when
 *                    `downloadHref` is present.
 * - `openLabel`    : localized label for the "Open in new tab" button; when
 *                    undefined, the open-in-new-tab action is not rendered.
 */
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

// ---------------------------------------------------------------------------
// PdfModal
// ---------------------------------------------------------------------------

export function PdfModal({ closeLabel, config, isOpen, onClose }: PdfModalProps) {
  const { title, hideTitle, previewSrc, pdfSrc, downloadHref, downloadLabel, openLabel } = config;

  // Resolve the iframe source: explicit pdfSrc takes priority, then downloadHref.
  const iframeSrc = pdfSrc ?? downloadHref;

  // Header action row — only rendered when at least one action is configured.
  // Diploma omits downloadHref entirely, so headerActions will be undefined and
  // no action row is passed to Modal.
  const headerActions =
    downloadHref ? (
      <div className="flex shrink-0 items-center gap-2">
        {/* Download action */}
        <a
          aria-label={downloadLabel}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          download
          href={downloadHref}
        >
          <HandwrittenIcon className="size-4 shrink-0" icon="download" />
          {downloadLabel}
        </a>

        {/* Open in new tab action — only rendered when openLabel is provided */}
        {openLabel ? (
          <a
            aria-label={openLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            href={downloadHref}
            rel="noreferrer"
            target="_blank"
          >
            {openLabel}
            <HandwrittenIcon className="size-4 shrink-0" icon="rightArrow" />
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
      {/* PDF viewer — mutual exclusivity by viewport:
          < 768 px  → WebP preview image only  (no iframe in layout/a11y tree)
          ≥ 768 px  → PDF iframe only          (no image in layout/a11y tree)
          `hidden` / `md:hidden` use `display:none`, fully removing the element
          from layout and the accessibility tree so neither alternative leaks. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {previewSrc ? (
          // Mobile-only preview image — hidden at md breakpoint and above.
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
          // Desktop/tablet iframe — hidden below md breakpoint.
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
