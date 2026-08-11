import "server-only";

import type { Slot, Timezone } from "./domain";
import { getValidStartTimes, isDateWithinBusinessRules } from "./availability-rules";

export type AvailabilityQuery = {
  date: string;
  timezone: Timezone;
};

export interface AvailabilityRepository {
  getSlots(query: AvailabilityQuery): Promise<Slot[]>;
  isAvailableDate(query: AvailabilityQuery): boolean;
}

function hashCode(value: string) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

export class MockAvailabilityRepository implements AvailabilityRepository {
  constructor(private readonly now: () => Date = () => new Date()) {}

  isAvailableDate({ date, timezone }: AvailabilityQuery) {
    return isDateWithinBusinessRules(date, timezone, this.now());
  }

  async getSlots({ date, timezone }: AvailabilityQuery): Promise<Slot[]> {
    const now = this.now();

    if (!isDateWithinBusinessRules(date, timezone, now)) {
      return [];
    }

    const dateHash = hashCode(`${date}:${timezone}`);

    return getValidStartTimes(date, timezone, now)
      .filter(({ time }) => (dateHash + hashCode(time)) % 3 !== 0)
      .map(({ time }) => ({ time, available: true }));
  }
}
