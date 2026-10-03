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

export const DEFAULT_AFDIAN_SPONSORSHIP_CONFIG: AfdianSponsorshipConfig = {
  creatorUrl: 'https://afdian.com/a/afdian',
  acceptingCheckout: false,
  acceptingCustomAmount: true,
  ordersAcceptedAfter: null,
  tiers: {
    faint_light: { planId: '', minimumAmountFen: 1 },
    fellow_traveler: { planId: '', minimumAmountFen: 3_800 },
    night_guardian: { planId: '', minimumAmountFen: 9_800 },
    immortality_witness: { planId: '', minimumAmountFen: 18_800 },
  },
};

export function parseCnyAmountToFen(value: string): number | null {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const yuan = Number(match[1]);
  const decimals = (match[2] ?? '').padEnd(2, '0');
  const fen = yuan * 100 + Number(decimals || '0');
  return Number.isSafeInteger(fen) ? fen : null;
}

export function resolveSponsorshipTier(
  input: { planId?: string | null; totalAmountFen: number },
  config: AfdianSponsorshipConfig,
): SponsorshipTierId | null {
  const planId = input.planId?.trim();
  if (planId) {
    for (const tierId of SPONSORSHIP_TIER_IDS) {
      if (config.tiers[tierId].planId === planId) return tierId;
    }
    return null;
  }
  if (!config.acceptingCustomAmount) return null;

  let resolved: SponsorshipTierId | null = null;
  for (const tierId of SPONSORSHIP_TIER_IDS) {
    if (input.totalAmountFen >= config.tiers[tierId].minimumAmountFen) {
      resolved = tierId;
    }
  }
  return resolved;
}

export function isSponsorshipOrderAccepted(
  createdAt: Date | null,
  config: AfdianSponsorshipConfig,
): boolean {
  if (
    !config.acceptingCheckout ||
    !config.ordersAcceptedAfter ||
    !createdAt ||
    Number.isNaN(createdAt.getTime())
  ) {
    return false;
  }
  return createdAt.getTime() >= Date.parse(config.ordersAcceptedAfter);
}

export function highestSponsorshipTier(
  tiers: SponsorshipTierId[],
): SponsorshipTierId | null {
  let result: SponsorshipTierId | null = null;
  for (const tier of tiers) {
    if (
      result === null ||
      SPONSORSHIP_TIER_META[tier].rank > SPONSORSHIP_TIER_META[result].rank
    ) {
      result = tier;
    }
  }
  return result;
}

export function formatSponsorshipMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}
