import "server-only";

export const BOUNDED_TIMEOUT_ERROR_CODES = {
  TIMEOUT: "TIMEOUT",
} as const;

export class BoundedTimeoutError extends Error {
  readonly code = BOUNDED_TIMEOUT_ERROR_CODES.TIMEOUT;

  constructor() {
    super("Operation timed out");
    this.name = "BoundedTimeoutError";
  }
}

/**
 * Bounds an async operation and aborts work that accepts an AbortSignal.
 *
 * The operation is always observed after a timeout, so a late rejection cannot
 * become unhandled. Callers must pass the signal to supported transports.
 */
export function withBoundedTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;

    function settle(complete: (value: T | PromiseLike<T>) => void, value: T) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      complete(value);
    }
    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }

    const timeout = setTimeout(() => {
      const error = new BoundedTimeoutError();
      controller.abort(error);
      fail(error);
    }, timeoutMs);

    // `then` observes late settlement after an abort instead of leaving a
    // detached Promise.race branch with an unhandled rejection.
    void Promise.resolve()
      .then(() => operation(controller.signal))
      .then((value) => settle(resolve, value), fail);
  });
}
