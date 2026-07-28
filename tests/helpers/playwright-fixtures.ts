import type { BookingRequestDto } from "@/lib/meet/dto";

export interface PlaywrightBookingSeed {
  meetingId: string;
  rawTokens: readonly string[];
}

export interface PlaywrightBookingSeeder {
  seedBooking(request: BookingRequestDto): Promise<PlaywrightBookingSeed>;
}

/**
 * Phase 6 supplies the API-backed seeder. This stable boundary keeps raw test
 * tokens isolated from production code and avoids introducing a test-only API in Phase 1.
 */
export function seedBookingForE2E(
  seeder: PlaywrightBookingSeeder,
  request: BookingRequestDto,
): Promise<PlaywrightBookingSeed> {
  return seeder.seedBooking(request);
}
