"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

type ModalProps = {
  children: React.ReactNode;
  closeLabel?: string;
  footer?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
  title: string;
};

/**
 * Module-level active-modal counter.
 *
 * Every open Modal increments it; every closing Modal decrements it.
 * Rules:
 *   - Only the FIRST open modal locks body scroll (count goes 0 → 1).
 *   - Only the LAST closing modal unlocks body scroll (count goes 1 → 0).
 *   - Escape key: the innermost modal handles it and stops propagation so
 *     the parent modal's listener never fires.
 *
 * Using a plain mutable object (not React state) because it is shared
 * across all Modal instances synchronously within the same JS event loop.
 */
const modalStack = { depth: 0, originalOverflow: "" };

export function Modal({
  children,
  closeLabel = "Close modal",
  footer,
  isOpen,
  onClose,
  size = "md",
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Stable ref so the keydown handler always has the latest onClose without
  // being in the useEffect dependency array (which would re-register and
  // steal focus from active inputs on every render).
  const onCloseRef = useRef(onClose);
  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Keep the ref current without triggering the focus effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Capture opener before modifying focus
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Only the first modal in the stack locks body scroll; subsequent modals
    // (e.g. nested MeetingModal inside ServiceRequestModal) skip locking since
    // it is already locked, which prevents double-restore on close.
    modalStack.depth += 1;
    if (modalStack.depth === 1) {
      modalStack.originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    // Focus the modal container once on open. Subsequent re-renders must NOT
    // re-call focus() — that is what steals focus from inputs.
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Stop propagation so parent modals' listeners don't also fire when a
        // child modal is the one handling this Escape press.
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Use capture phase so the innermost modal's listener runs before any
    // parent modal listeners, enabling stopPropagation to silence the parent.
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);

      // Decrement stack; only restore scroll when the last modal closes.
      modalStack.depth = Math.max(0, modalStack.depth - 1);
      if (modalStack.depth === 0) {
        document.body.style.overflow = modalStack.originalOverflow;
        modalStack.originalOverflow = "";
      }

      openerRef.current?.focus();
    };
    // Intentionally omit onClose — it is captured via onCloseRef.
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-8">
      <button
        aria-label={closeLabel}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-[20px] border border-border bg-card text-foreground shadow-pill outline-none motion-safe:animate-[fade-in_240ms_ease-out_both] ${
          size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-2xl"
        }`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4">
          <h2 className="text-2xl font-semibold tracking-tight" id={titleId}>{title}</h2>
          <button
            aria-label={closeLabel}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={onClose}
            type="button"
          >
            <Image alt="" aria-hidden="true" className="size-4 dark:invert" height={16} src="/handwritten-icons/close.svg" width={16} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="modal-scroll-area flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
        {/* Sticky footer */}
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
