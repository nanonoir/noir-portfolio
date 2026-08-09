import "server-only";

import { MockAvailabilityRepository, type AvailabilityRepository } from "./availability-repository";
import {
  GoogleCalendarAvailabilityProvider,
  UnverifiedAvailabilityProvider,
} from "./availability-providers";
import { resolveTimezone } from "./availability-rules";
import { MEETING_ERROR_CODES, MEETING_RESPONSE_CODES } from "./codes";
import type {
  AvailabilityErrorResponseDto,
  AvailabilitySuccessResponseDto,
} from "./dto";
import type { Timezone } from "./domain";
import { availabilityRequestSchema } from "./schemas";
import { isBackendE2ETestComposition, isFirebaseConfigured } from "@/lib/server/env";
import { isFreeBusyConfigured } from "@/lib/server/google-calendar-freebusy";
import { meetLogger, normalizeErrorCause } from "./logger";

export type AvailabilityServiceResponse = AvailabilitySuccessResponseDto | AvailabilityErrorResponseDto;

/** Selects the availability provider for the current server environment. */
export function createAvailabilityRepository(): AvailabilityRepository {
  // Keep browser backend tests deterministic while using real persistence.
  if (isBackendE2ETestComposition()) {
    return new MockAvailabilityRepository();
  }
  if (isFreeBusyConfigured()) {
    return new GoogleCalendarAvailabilityProvider();
  }
  if (isFirebaseConfigured()) {
    return new UnverifiedAvailabilityProvider();
  }
  return new MockAvailabilityRepository();
}

interface AvailabilityRequestInput {
  date: string | null;
  timezone: string | null;
}

export class AvailabilityService {
  constructor(
    private readonly repository: AvailabilityRepository = createAvailabilityRepository(),
  ) {}

  async getAvailability(request: AvailabilityRequestInput): Promise<AvailabilityServiceResponse> {
    const providedTimezone = request.timezone?.trim() || null;
    const { timezone } = resolveTimezone(providedTimezone, null);

    if (!timezone) {
      return { success: false, error: MEETING_ERROR_CODES.INVALID_TIMEZONE };
    }

    const parsed = availabilityRequestSchema.safeParse({
      date: request.date,
      timezone,
    });

    if (!parsed.success) {
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR };
    }

    const query = {
      date: parsed.data.date,
      timezone: parsed.data.timezone as Timezone,
    };

    let dateWithinBusinessRules: boolean;
    try {
      dateWithinBusinessRules = await this.repository.isAvailableDate(query);
    } catch (error) {
      meetLogger.error("availability.repository.is_available_date_failed", { cause: normalizeErrorCause(error) });
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_UNAVAILABLE };
    }

    if (!dateWithinBusinessRules) {
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR };
    }

    try {
      const slots = await this.repository.getSlots(query);

      return {
        success: true,
        code: MEETING_RESPONSE_CODES.AVAILABILITY_AVAILABLE,
        date: parsed.data.date,
        timezone: parsed.data.timezone,
        slots,
      };
    } catch (error) {
      meetLogger.error("availability.repository.get_slots_failed", { cause: normalizeErrorCause(error) });
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_UNAVAILABLE };
    }
  }
}

export const availabilityService = new AvailabilityService();
