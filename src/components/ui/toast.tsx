"use client";

type ToastProps = {
  message: string;
  isVisible: boolean;
};

export function Toast({ isVisible, message }: ToastProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 rounded-full border border-border bg-card px-5 py-3 text-sm text-foreground shadow-pill"
      role="status"
    >
      {message}
    </div>
  );
}
