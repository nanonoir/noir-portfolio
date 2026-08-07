"use client";

import { HandwrittenIcon } from "./handwritten-icon";

const TOAST_VARIANTS = {
  ERROR: "error",
  SUCCESS: "success",
  WARNING: "warning",
} as const;

type ToastVariant = (typeof TOAST_VARIANTS)[keyof typeof TOAST_VARIANTS];

type ToastProps = {
  message: string;
  isVisible: boolean;
  variant?: ToastVariant;
};

export function Toast({ isVisible, message, variant = TOAST_VARIANTS.SUCCESS }: ToastProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm text-foreground shadow-pill"
      role="status"
    >
      <HandwrittenIcon
        className="size-4 shrink-0"
        icon={variant === TOAST_VARIANTS.SUCCESS ? "check" : variant === TOAST_VARIANTS.WARNING ? "warning" : "networkError"}
      />
      <span>{message}</span>
    </div>
  );
}
