import "server-only";

import { MEETING_ERROR_CODES, MEETING_RESPONSE_CODES } from "./codes";
import type { AvailabilityErrorResponseDto, AvailabilitySuccessResponseDto } from "./dto";
import type { Timezone } from "./domain";
import { availabilityRequestSchema } from "./schemas";
import { MockAvailabilityRepository, type AvailabilityRepository } from "./availability-repository";

export type AvailabilityServiceResponse = AvailabilitySuccessResponseDto | AvailabilityErrorResponseDto;

export class AvailabilityService {
  constructor(private readonly repository: AvailabilityRepository = new MockAvailabilityRepository()) {}

  async getAvailability(request: unknown): Promise<AvailabilityServiceResponse> {
    const parsed = availabilityRequestSchema.safeParse(request);

    if (!parsed.success) {
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR };
    }

    const query = {
      ...parsed.data,
      timezone: parsed.data.timezone as Timezone,
    };

    if (!this.repository.isAvailableDate(query)) {
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR };
    }

    try {
      return {
        success: true,
        code: MEETING_RESPONSE_CODES.AVAILABILITY_AVAILABLE,
        date: parsed.data.date,
        timezone: parsed.data.timezone,
        slots: await this.repository.getSlots(query),
      };
    } catch {
      return { success: false, error: MEETING_ERROR_CODES.AVAILABILITY_ERROR };
    }
  }
}

export const availabilityService = new AvailabilityService();
