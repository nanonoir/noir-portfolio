"use client";

import { useEffect, useRef, useState } from "react";
import { HandwrittenIcon } from "./handwritten-icon";

type ModalProps = {
  children: React.ReactNode;
  closeLabel?: string;
  footer?: React.ReactNode;
  /** Extra controls rendered to the left of the close button in the modal header. */
  headerActions?: React.ReactNode;
  /** When true the title is rendered as sr-only (visually hidden). */
  hideTitle?: boolean;
  initialFocus?: "dialog" | "heading" | "first-interactive";
  isOpen: boolean;
  onClose: () => void;
  restoreFocus?: boolean;
  size?: "md" | "lg" | "xl";
  title: string;
};

/**
 * Module-level active-modal stack.
 *
 * Every open Modal registers a token; every closing Modal removes its token.
 * Rules:
 *   - Only the FIRST open modal locks body scroll.
 *   - Only the LAST closing modal unlocks body scroll.
 *   - Only the topmost token handles Escape and Tab. This explicit identity
 *     check is required because stopPropagation does not stop listeners on
 *     the same document node.
 *
 * Using a plain mutable object (not React state) because it is shared
 * across all Modal instances synchronously within the same JS event loop.
 */
const modalStack = { entries: [] as symbol[], originalOverflow: "" };

export function Modal({
  children,
  closeLabel = "Close modal",
  footer,
  headerActions,
  hideTitle,
  initialFocus = "dialog",
  isOpen,
  onClose,
  restoreFocus = true,
  size = "md",
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(restoreFocus);
  const [isPresent, setIsPresent] = useState(isOpen);
  const [phase, setPhase] = useState<"open" | "closing">("open");
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
    restoreFocusRef.current = restoreFocus;
  }, [restoreFocus]);

  useEffect(() => {
    if (isOpen) {
      const frame = window.requestAnimationFrame(() => {
        setIsPresent(true);
        setPhase("open");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(() => setPhase("closing"));
    const timeout = window.setTimeout(() => setIsPresent(false), 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const modalToken = Symbol("modal");

    // Capture opener before modifying focus
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Only the first modal in the stack locks body scroll; subsequent modals
    // (e.g. nested MeetingModal inside ServiceRequestModal) skip locking since
    // it is already locked, which prevents double-restore on close.
    modalStack.entries.push(modalToken);
    if (modalStack.entries.length === 1) {
      modalStack.originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    // Focus once on open. Subsequent renders must NOT steal focus from inputs.
    const focusTarget = initialFocus === "heading"
      ? dialogRef.current?.querySelector<HTMLElement>("h2")
      : initialFocus === "first-interactive"
        ? dialogRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])')
        : dialogRef.current;
    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      const topmostToken = modalStack.entries[modalStack.entries.length - 1];

      // All Modal listeners are attached to document in capture phase. Since
      // they share the same node, propagation controls cannot distinguish
      // them; only the active stack identity can isolate the topmost modal.
      if (topmostToken !== modalToken) {
        return;
      }

      if (event.key === "Escape") {
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

      // Remove this modal; only restore scroll when the last modal closes.
      const entryIndex = modalStack.entries.indexOf(modalToken);
      if (entryIndex >= 0) {
        modalStack.entries.splice(entryIndex, 1);
      }

      if (modalStack.entries.length === 0) {
        document.body.style.overflow = modalStack.originalOverflow;
        modalStack.originalOverflow = "";
      }

      if (restoreFocusRef.current) {
        openerRef.current?.focus();
      }
    };
    // Intentionally omit onClose — it is captured via onCloseRef.
  }, [initialFocus, isOpen]);

  if (!isPresent) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-8" data-modal-phase={phase}>
      <button
        aria-label={closeLabel}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-[20px] border border-border bg-card text-foreground shadow-pill outline-none transition-[opacity,transform] duration-180 ${phase === "closing" ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"} ${
          size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-2xl"
        }`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-4">
          <h2
            className={hideTitle ? "sr-only" : "text-2xl font-semibold tracking-tight"}
            id={titleId}
            tabIndex={-1}
          >
            {title}
          </h2>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {headerActions ?? null}
            <button
              aria-label={closeLabel}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={onClose}
              type="button"
            >
              <HandwrittenIcon className="size-4" icon="close" />
            </button>
          </div>
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
