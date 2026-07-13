import type { SlotIdentity, Timezone } from "./domain";
import { getZonedDateTime } from "./zoned-date-time";

export interface SlotIdentityInput {
  date: string;
  time: string;
  timezone: Timezone;
}

export function getSlotIdentity({ date, time, timezone }: SlotIdentityInput): SlotIdentity {
  return getZonedDateTime({ date, time, timezone }).toISOString() as SlotIdentity;
}
