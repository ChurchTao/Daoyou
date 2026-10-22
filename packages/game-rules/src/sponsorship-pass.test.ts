import { DEFAULT_AFDIAN_SPONSORSHIP_CONFIG } from '@daoyou/game-content/sponsorship/defaults';
import { AfdianSponsorshipConfigSchema } from '@daoyou/game-domain/sponsorship';
import { describe, expect, it } from 'vitest';
import {
  extendSubscriptionEnd,
  resolveSubscriptionTermEnd,
  selectActiveSubscriptionPlan,
  sponsorshipCalendarDate,
  sponsorshipTierSupply,
  withSeededSubscriptionPlans,
  type SubscriptionPlanFact,
  type SubscriptionTermFact,
} from './sponsorship-pass.js';

const low: SubscriptionPlanFact = {
  id: 'low',
  name: '微光',
  enabled: true,
  dailyRewardCount: 1,
};
const high: SubscriptionPlanFact = {
  id: 'high',
  name: '长生',
  enabled: true,
  dailyRewardCount: 2,
};

function term(
  planId: string,
  level: number,
  startsAt: string,
  endsAt: string | null,
): SubscriptionTermFact {
  return {
    id: planId,
    planId,
    level,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
  };
}

describe('subscription pass rules', () => {
  it('does not extend a provisional subscription again for retries or older orders', () => {
    const anchor = new Date('2026-10-12T04:00:00Z');
    const endsAt = extendSubscriptionEnd(anchor, 1);
    const existing = { endsAt, latestOrderAt: anchor };
    for (const at of [anchor, new Date('2026-10-01T04:00:00Z')]) {
      expect(
        resolveSubscriptionTermEnd({
          sponsorPlan: null,
          month: 1,
          anchor: at,
          existing,
        }),
      ).toEqual({ endsAt, provisional: true });
    }
    expect(
      resolveSubscriptionTermEnd({
        sponsorPlan: null,
        month: 1,
        anchor: new Date('2026-10-15T04:00:00Z'),
        existing,
      })?.endsAt,
    ).toEqual(extendSubscriptionEnd(endsAt, 1));
    expect(
      resolveSubscriptionTermEnd({
        sponsorPlan: null,
        month: null,
        anchor,
        existing: null,
      }),
    ).toBeNull();
  });

  it('uses the provider expiry even when it shortens an existing term', () => {
    const anchor = new Date('2026-10-12T04:00:00Z');
    expect(
      resolveSubscriptionTermEnd({
        sponsorPlan: { permanent: false, expireTime: anchor },
        month: 1,
        anchor,
        existing: {
          endsAt: extendSubscriptionEnd(anchor, 1),
          latestOrderAt: anchor,
        },
      }),
    ).toEqual({ endsAt: anchor, provisional: false });
    expect(
      resolveSubscriptionTermEnd({
        sponsorPlan: { permanent: true, expireTime: null },
        month: 1,
        anchor,
        existing: null,
      }),
    ).toEqual({ endsAt: null, provisional: false });
  });

  it('selects the identity with the longer expiry when two payers support the same plan', () => {
    const source = term('low', 1, '2026-10-01T00:00:00Z', null);
    const at = new Date('2026-10-12T04:00:00Z');
    expect(
      selectActiveSubscriptionPlan(
        [
          {
            ...source,
            id: 'payer-a',
            endsAt: new Date('2026-11-01T00:00:00Z'),
          },
          { ...source, id: 'payer-b' },
        ],
        [low],
        at,
      )?.termId,
    ).toBe('payer-b');
  });
  it('keeps legacy configs without a plan list', () => {
    const legacy = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    delete (legacy as { subscriptionPlans?: unknown }).subscriptionPlans;
    expect(
      AfdianSponsorshipConfigSchema.parse(legacy).subscriptionPlans,
    ).toEqual([]);
  });

  it('rejects duplicate levels and afdian plan ids', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.subscriptionPlans = [
      {
        id: 'alpha',
        level: 1,
        name: '甲',
        afdianPlanId: 'same',
        enabled: true,
        dailyRewards: [],
      },
      {
        id: 'beta',
        level: 1,
        name: '乙',
        afdianPlanId: 'same',
        enabled: true,
        dailyRewards: [],
      },
    ];
    expect(AfdianSponsorshipConfigSchema.safeParse(config).success).toBe(false);
  });

  it('seeds empty plans from configured merit tiers', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.tiers.faint_light.planId = 'light';
    config.tiers.night_guardian.planId = 'night';
    const seeded = withSeededSubscriptionPlans(config);
    expect(seeded.subscriptionPlans.map((plan) => plan.id)).toEqual([
      'faint_light',
      'night_guardian',
    ]);
    expect(seeded.subscriptionPlans.map((plan) => plan.level)).toEqual([1, 3]);
    expect(withSeededSubscriptionPlans(seeded)).toBe(seeded);
  });

  it('discloses daily supply only for an enabled plan on that tier', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.tiers.faint_light.planId = 'light';
    config.tiers.fellow_traveler.planId = 'road';
    config.subscriptionPlans = [
      {
        id: 'faint_light',
        level: 1,
        name: '微光月札',
        afdianPlanId: 'light',
        enabled: true,
        dailyRewards: [{ type: 'spirit_stones', quantity: 20 }],
      },
      {
        id: 'fellow_traveler',
        level: 2,
        name: '同程月札',
        afdianPlanId: 'road',
        enabled: false,
        dailyRewards: [{ type: 'reputation', quantity: 5 }],
      },
    ];
    expect(sponsorshipTierSupply(config, 'faint_light')).toEqual({
      name: '微光月札',
      level: 1,
      dailyRewards: [{ type: 'spirit_stones', quantity: 20 }],
    });
    expect(sponsorshipTierSupply(config, 'fellow_traveler')).toBeNull();
    expect(sponsorshipTierSupply(config, 'night_guardian')).toBeNull();
  });

  it('extends by Shanghai calendar months and clamps short months', () => {
    expect(
      extendSubscriptionEnd(
        new Date('2026-01-31T02:00:00.000Z'),
        1,
      ).toISOString(),
    ).toBe('2026-02-27T16:00:00.000Z');
    expect(
      extendSubscriptionEnd(
        new Date('2024-01-31T02:00:00.000Z'),
        1,
      ).toISOString(),
    ).toBe('2024-02-28T16:00:00.000Z');
    expect(
      extendSubscriptionEnd(
        new Date('2026-02-28T16:00:00.000Z'),
        1,
      ).toISOString(),
    ).toBe('2026-03-31T16:00:00.000Z');
  });

  it('uses the Shanghai date of an observation and does not invent missing days', () => {
    expect(sponsorshipCalendarDate(new Date('2026-10-12T15:30:00.000Z'))).toBe(
      '2026-10-12',
    );
    const observed = [
      new Date('2026-10-12T16:30:00.000Z'),
      new Date('2026-10-13T02:00:00.000Z'),
    ].map(sponsorshipCalendarDate);
    expect(observed).toEqual(['2026-10-13', '2026-10-13']);
    expect(observed).not.toContain('2026-10-11');
  });

  it('pays the highest active level and returns to the lower one the next day', () => {
    const plans = [low, high];
    const terms = [
      term('low', 1, '2026-10-01T16:00:00.000Z', '2026-11-01T16:00:00.000Z'),
      term('high', 4, '2026-10-10T16:00:00.000Z', '2026-10-20T16:00:00.000Z'),
    ];
    expect(
      selectActiveSubscriptionPlan(
        terms,
        plans,
        new Date('2026-10-12T04:00:00.000Z'),
        { requireRewards: true },
      )?.planId,
    ).toBe('high');
    expect(
      selectActiveSubscriptionPlan(
        terms,
        plans,
        new Date('2026-10-20T16:00:00.000Z'),
        { requireRewards: true },
      )?.planId,
    ).toBe('low');
    expect(
      selectActiveSubscriptionPlan(
        terms,
        plans,
        new Date('2026-11-01T16:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('skips disabled plans, empty rewards, and keeps a permanent plan open', () => {
    const at = new Date('2026-10-13T04:00:00.000Z');
    const terms = [
      term('low', 1, '2026-10-01T16:00:00.000Z', null),
      term('high', 4, '2026-10-01T16:00:00.000Z', '2026-12-01T16:00:00.000Z'),
    ];
    expect(
      selectActiveSubscriptionPlan(
        terms,
        [{ ...high, enabled: false }, low],
        at,
      )?.planId,
    ).toBe('low');
    expect(
      selectActiveSubscriptionPlan(
        terms,
        [{ ...high, dailyRewardCount: 0 }, low],
        at,
        { requireRewards: true },
      )?.planId,
    ).toBe('low');
    expect(selectActiveSubscriptionPlan(terms, [low], at)?.endsAt).toBeNull();
  });
});
