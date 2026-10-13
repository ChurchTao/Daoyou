import type { RewardSelection } from './rewards/selection.js';
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

export const SPONSORSHIP_TIER_REPUTATION_PER_MONTH: Record<
  SponsorshipTierId,
  number
> = {
  faint_light: 50,
  fellow_traveler: 200,
  night_guardian: 400,
  immortality_witness: 900,
};

const SponsorshipTierConfigSchema = (tier: SponsorshipTierId) =>
  z.object({
    planId: z.string().trim().max(80).default(''),
    minimumAmountFen: z.number().int().min(1).max(100_000_000),
    reputationPerMonth: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .default(SPONSORSHIP_TIER_REPUTATION_PER_MONTH[tier]),
  });

export const SubscriptionPlanSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, '方案 ID 只能使用小写字母、数字和下划线'),
  level: z.number().int().min(1).max(10_000),
  name: z.string().trim().min(1).max(40),
  afdianPlanId: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  dailyRewards: z.custom<RewardSelection[]>(
    (value) => Array.isArray(value) && value.length <= 30,
    '每日物资最多 30 项',
  ),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

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
      faint_light: SponsorshipTierConfigSchema('faint_light'),
      fellow_traveler: SponsorshipTierConfigSchema('fellow_traveler'),
      night_guardian: SponsorshipTierConfigSchema('night_guardian'),
      immortality_witness: SponsorshipTierConfigSchema('immortality_witness'),
    }),
    subscriptionPlans: z.array(SubscriptionPlanSchema).max(40).default([]),
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
    const subscriptionIds = new Set<string>();
    const levels = new Set<number>();
    const afdianPlanIds = new Set<string>();
    for (const [index, plan] of value.subscriptionPlans.entries()) {
      if (subscriptionIds.has(plan.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionPlans', index, 'id'],
          message: '订阅方案 ID 重复',
        });
      }
      if (levels.has(plan.level)) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionPlans', index, 'level'],
          message: '订阅等级不能重复',
        });
      }
      if (afdianPlanIds.has(plan.afdianPlanId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionPlans', index, 'afdianPlanId'],
          message: '不同订阅不能使用相同的爱发电方案',
        });
      }
      subscriptionIds.add(plan.id);
      levels.add(plan.level);
      afdianPlanIds.add(plan.afdianPlanId);
    }
  });


export type AfdianSponsorshipConfig = z.infer<
  typeof AfdianSponsorshipConfigSchema
>;
