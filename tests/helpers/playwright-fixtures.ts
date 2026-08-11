import type { BookingRequestDto } from "@/lib/meet/dto";

export interface PlaywrightBookingSeed {
  meetingId: string;
  rawTokens: readonly string[];
}

export interface PlaywrightBookingSeeder {
  seedBooking(request: BookingRequestDto): Promise<PlaywrightBookingSeed>;
}

/** Keeps raw test tokens isolated from production code. */
export function seedBookingForE2E(
  seeder: PlaywrightBookingSeeder,
  request: BookingRequestDto,
): Promise<PlaywrightBookingSeed> {
  return seeder.seedBooking(request);
}
