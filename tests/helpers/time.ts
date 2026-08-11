export interface FixedClock {
  advanceHours(hours: number): void;
  now(): Date;
}

export function fixedClock(iso: string): FixedClock {
  let current = new Date(iso);

  if (Number.isNaN(current.getTime())) {
    throw new Error(`Invalid fixed clock value: ${iso}`);
  }

  return {
    advanceHours(hours: number): void {
      current = new Date(current.getTime() + hours * 60 * 60 * 1000);
    },
    now(): Date {
      return new Date(current);
    },
  };
}
