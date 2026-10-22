import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type AfdianSponsorshipConfig,
  type SubscriptionPlan,
} from '@daoyou/game-domain/sponsorship';
import { RewardSelectionsSchema } from './rewards/items.js';

const SHANGHAI = 'Asia/Shanghai';

export type SubscriptionTermFact = {
  id: string;
  planId: string;
  level: number;
  startsAt: Date;
  endsAt: Date | null;
};

export type SubscriptionPlanFact = {
  id: string;
  name: string;
  enabled: boolean;
  dailyRewardCount: number;
};

export type ActiveSubscription = {
  termId: string;
  planId: string;
  name: string;
  level: number;
  endsAt: Date | null;
  hasRewards: boolean;
};

function shanghaiParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function shanghaiMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
}

export function sponsorshipCalendarDate(date: Date): string {
  const { year, month, day } = shanghaiParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Exclusive end at Shanghai midnight, clamped to the target month's last day. */
export function extendSubscriptionEnd(anchor: Date, months: number): Date {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error('赞助月份无效');
  }
  const { year, month, day } = shanghaiParts(anchor);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return shanghaiMidnight(targetYear, targetMonth, Math.min(day, lastDay));
}

export function readSubscriptionRewards(value: unknown) {
  const parsed = RewardSelectionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type SponsorshipTierSupply = {
  name: string;
  level: number;
  dailyRewards: NonNullable<ReturnType<typeof readSubscriptionRewards>>;
};

export function sponsorshipTierSupply(
  config: AfdianSponsorshipConfig,
  tierId: (typeof SPONSORSHIP_TIER_IDS)[number],
): SponsorshipTierSupply | null {
  const plan = findSubscriptionPlan(config, config.tiers[tierId].planId);
  if (!plan?.enabled) return null;
  return {
    name: plan.name,
    level: plan.level,
    dailyRewards: readSubscriptionRewards(plan.dailyRewards) ?? [],
  };
}

export function findSubscriptionPlan(
  config: AfdianSponsorshipConfig,
  afdianPlanId: string | null | undefined,
): SubscriptionPlan | null {
  const planId = afdianPlanId?.trim();
  if (!planId) return null;
  return (
    config.subscriptionPlans.find((plan) => plan.afdianPlanId === planId) ??
    null
  );
}

export function withSeededSubscriptionPlans(
  config: AfdianSponsorshipConfig,
): AfdianSponsorshipConfig {
  if (config.subscriptionPlans.length > 0) return config;
  const subscriptionPlans = SPONSORSHIP_TIER_IDS.flatMap((id) => {
    const afdianPlanId = config.tiers[id].planId.trim();
    if (!afdianPlanId) return [];
    return [
      {
        id,
        level: SPONSORSHIP_TIER_META[id].rank + 1,
        name: SPONSORSHIP_TIER_META[id].name,
        afdianPlanId,
        enabled: true,
        dailyRewards: [],
      },
    ];
  });
  return { ...config, subscriptionPlans };
}

function preferActive(
  candidate: ActiveSubscription,
  selected: ActiveSubscription,
): boolean {
  if (candidate.level !== selected.level)
    return candidate.level > selected.level;
  if (candidate.endsAt === null) return selected.endsAt !== null;
  if (selected.endsAt === null) return false;
  return candidate.endsAt.getTime() > selected.endsAt.getTime();
}

export function selectActiveSubscriptionPlan(
  terms: SubscriptionTermFact[],
  plans: SubscriptionPlanFact[],
  at: Date,
  options?: { requireRewards?: boolean },
): ActiveSubscription | null {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  let selected: ActiveSubscription | null = null;
  for (const term of terms) {
    if (term.startsAt.getTime() > at.getTime()) continue;
    if (term.endsAt && term.endsAt.getTime() <= at.getTime()) continue;
    const plan = plansById.get(term.planId);
    if (!plan?.enabled) continue;
    const hasRewards = plan.dailyRewardCount > 0;
    if (options?.requireRewards && !hasRewards) continue;
    const candidate: ActiveSubscription = {
      termId: term.id,
      planId: plan.id,
      name: plan.name,
      level: term.level,
      endsAt: term.endsAt,
      hasRewards,
    };
    if (!selected || preferActive(candidate, selected)) selected = candidate;
  }
  return selected;
}

/** A retry or older order must not extend the same provisional term twice. */
export function resolveSubscriptionTermEnd(args: {
  sponsorPlan: { permanent: boolean; expireTime: Date | null } | null;
  month: number | null;
  anchor: Date;
  existing: { endsAt: Date | null; latestOrderAt: Date } | null;
}): { endsAt: Date | null; provisional: boolean } | null {
  if (args.sponsorPlan?.permanent) {
    return { endsAt: null, provisional: false };
  }
  if (args.sponsorPlan?.expireTime) {
    return { endsAt: args.sponsorPlan.expireTime, provisional: false };
  }
  if (
    args.existing &&
    (args.existing.endsAt === null ||
      args.existing.latestOrderAt >= args.anchor)
  ) {
    return { endsAt: args.existing.endsAt, provisional: true };
  }
  if (!args.month || args.month < 1) return null;
  const base =
    args.existing?.endsAt && args.existing.endsAt > args.anchor
      ? args.existing.endsAt
      : args.anchor;
  return { endsAt: extendSubscriptionEnd(base, args.month), provisional: true };
}
