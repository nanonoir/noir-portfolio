"use client";

import { Modal } from "./modal";

type PdfModalProps = {
  closeLabel: string;
  isOpen: boolean;
  onClose: () => void;
  src: string;
  title: string;
};

export function PdfModal({ closeLabel, isOpen, onClose, src, title }: PdfModalProps) {
  return (
    <Modal closeLabel={closeLabel} isOpen={isOpen} onClose={onClose} size="xl" title={title}>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <iframe className="h-[72vh] w-full" src={src} title={title} />
      </div>
    </Modal>
  );
}
