import { z } from 'zod';


export const SPONSORSHIP_TIER_IDS = [
  'faint_light',
  'fellow_traveler',
  'night_guardian',
  'immortality_witness',
] as const;


export type SponsorshipTierId = (typeof SPONSORSHIP_TIER_IDS)[number];


export const SPONSORSHIP_TIER_META: Record<
  SponsorshipTierId,
  { name: string; rank: number; theme: string }
> = {
  faint_light: { name: '一盏微光', rank: 0, theme: '微光印记' },
  fellow_traveler: { name: '山水同程', rank: 1, theme: '山水纹章' },
  night_guardian: { name: '长夜护道', rank: 2, theme: '护道金印' },
  immortality_witness: { name: '共证长生', rank: 3, theme: '长生玉牒' },
};


const SponsorshipTierConfigSchema = z.object({
  planId: z.string().trim().max(80).default(''),
  minimumAmountFen: z.number().int().min(1).max(100_000_000),
});


export const AfdianSponsorshipConfigSchema = z
  .object({
    creatorUrl: z.url().refine((url) => new URL(url).protocol === 'https:', {
      message: '爱发电创作者地址必须使用 HTTPS',
    }),
    acceptingCheckout: z.boolean(),
    acceptingCustomAmount: z.boolean(),
    ordersAcceptedAfter: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .default(null),
    tiers: z.object({
      faint_light: SponsorshipTierConfigSchema,
      fellow_traveler: SponsorshipTierConfigSchema,
      night_guardian: SponsorshipTierConfigSchema,
      immortality_witness: SponsorshipTierConfigSchema,
    }),
  })
  .superRefine((value, ctx) => {
    const thresholds = SPONSORSHIP_TIER_IDS.map(
      (tier) => value.tiers[tier].minimumAmountFen,
    );
    for (let index = 1; index < thresholds.length; index += 1) {
      if (thresholds[index]! <= thresholds[index - 1]!) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiers', SPONSORSHIP_TIER_IDS[index], 'minimumAmountFen'],
          message: '档位最低金额必须严格递增',
        });
      }
    }
    const planIds = SPONSORSHIP_TIER_IDS.map(
      (tier) => value.tiers[tier].planId,
    ).filter(Boolean);
    if (new Set(planIds).size !== planIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: '不同档位不能使用相同的方案 ID',
      });
    }
  });


export type AfdianSponsorshipConfig = z.infer<
  typeof AfdianSponsorshipConfigSchema
>;
