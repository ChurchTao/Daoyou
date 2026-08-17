import { SPONSORSHIP_TIER_IDS } from '@shared/lib/sponsorship';
import { z } from 'zod';

export const SponsorshipCheckoutRequestSchema = z
  .object({
    tier: z.enum(SPONSORSHIP_TIER_IDS),
    publicListing: z.boolean().default(true),
    customAmountFen: z.number().int().min(1).max(100_000_000).optional(),
  })
  .strict();

export const SponsorshipClaimRequestSchema = z
  .object({
    code: z.string().trim().min(8).max(64),
    publicListing: z.boolean().default(true),
  })
  .strict();

export const SponsorshipVisibilityRequestSchema = z
  .object({ isPublic: z.boolean() })
  .strict();

export const SponsorshipPublicQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SponsorshipCheckoutRequest = z.infer<
  typeof SponsorshipCheckoutRequestSchema
>;
export type SponsorshipClaimRequest = z.infer<
  typeof SponsorshipClaimRequestSchema
>;
