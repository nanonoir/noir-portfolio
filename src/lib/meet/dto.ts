import "server-only";

import type { z } from "zod";
import type {
  availabilityErrorResponseSchema,
  availabilityRequestSchema,
  availabilitySuccessResponseSchema,
  bookingErrorResponseSchema,
  bookingRequestSchema,
  bookingSuccessResponseSchema,
  proposalMetadataSchema,
} from "./schemas";

export type AvailabilityRequestDto = z.infer<typeof availabilityRequestSchema>;
export type BookingRequestDto = z.infer<typeof bookingRequestSchema>;
export type ProposalMetadataDto = z.infer<typeof proposalMetadataSchema>;
export type AvailabilitySuccessResponseDto = z.infer<typeof availabilitySuccessResponseSchema>;
export type AvailabilityErrorResponseDto = z.infer<typeof availabilityErrorResponseSchema>;
export type BookingSuccessResponseDto = z.infer<typeof bookingSuccessResponseSchema>;
export type BookingErrorResponseDto = z.infer<typeof bookingErrorResponseSchema>;

declare const bookingPayloadHashBrand: unique symbol;

export type BookingPayloadHash = string & { readonly [bookingPayloadHashBrand]: "BookingPayloadHash" };

export const PROVIDER_DELIVERY_STATUSES = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type ProviderDeliveryStatus =
  (typeof PROVIDER_DELIVERY_STATUSES)[keyof typeof PROVIDER_DELIVERY_STATUSES];

export interface ProviderFailureMetadata {
  code: string;
  occurredAt: string;
}

export interface ProviderDeliveryState {
  attempts: number;
  lastError?: ProviderFailureMetadata;
  status: ProviderDeliveryStatus;
}
