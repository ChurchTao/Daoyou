import { describe, expect, it } from 'vitest';
import { AfdianSponsorshipConfigSchema, SPONSORSHIP_TIER_IDS } from '@daoyou/game-domain/sponsorship';
import { DEFAULT_AFDIAN_SPONSORSHIP_CONFIG } from '@daoyou/game-content/sponsorship/defaults';
import { formatSponsorshipMonth, highestSponsorshipTier, isSponsorshipOrderAccepted, parseCnyAmountToFen, resolveSponsorshipTier, sponsorshipReputationGain } from './sponsorship.js';

describe('sponsorship rules', () => {
  it.each([
    ['0.01', 1],
    ['38', 3_800],
    ['188.5', 18_850],
    ['188.50', 18_850],
    ['1.234', null],
    ['-1', null],
  ])('parses %s yuan to fen', (input, expected) => {
    expect(parseCnyAmountToFen(input)).toBe(expected);
  });

  it('uses an allowlisted plan before the discounted paid amount', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.acceptingCheckout = true;
    config.tiers.night_guardian.planId = 'night-plan';
    expect(
      resolveSponsorshipTier(
        { planId: 'night-plan', totalAmountFen: 1 },
        config,
      ),
    ).toBe('night_guardian');
  });

  it('does not treat an unmapped fixed plan as a custom-amount order', () => {
    expect(
      resolveSponsorshipTier(
        { planId: 'unknown-plan', totalAmountFen: 18_800 },
        DEFAULT_AFDIAN_SPONSORSHIP_CONFIG,
      ),
    ).toBeNull();
  });

  it.each([
    [1, 'faint_light'],
    [3_799, 'faint_light'],
    [3_800, 'fellow_traveler'],
    [9_800, 'night_guardian'],
    [18_800, 'immortality_witness'],
  ] as const)('resolves amount %i', (amount, expected) => {
    expect(
      resolveSponsorshipTier(
        { totalAmountFen: amount },
        DEFAULT_AFDIAN_SPONSORSHIP_CONFIG,
      ),
    ).toBe(expected);
  });

  it('keeps the historical highest tier', () => {
    expect(
      highestSponsorshipTier([
        'night_guardian',
        'faint_light',
        'fellow_traveler',
      ]),
    ).toBe('night_guardian');
  });

  it('accepts only orders at or after the server-managed activation time', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.acceptingCheckout = true;
    config.ordersAcceptedAfter = '2026-08-17T00:00:00.000Z';

    expect(
      isSponsorshipOrderAccepted(new Date('2026-08-16T23:59:59.999Z'), config),
    ).toBe(false);
    expect(
      isSponsorshipOrderAccepted(new Date('2026-08-17T00:00:00.000Z'), config),
    ).toBe(true);
    expect(isSponsorshipOrderAccepted(null, config)).toBe(false);
  });

  it('rejects automatic order handling until checkout is activated', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.ordersAcceptedAfter = '2026-08-17T00:00:00.000Z';
    expect(
      isSponsorshipOrderAccepted(new Date('2026-08-18T00:00:00.000Z'), config),
    ).toBe(false);
  });

  it('keeps persisted pre-cutoff configs backward compatible', () => {
    const legacy = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG) as Omit<
      typeof DEFAULT_AFDIAN_SPONSORSHIP_CONFIG,
      'ordersAcceptedAfter'
    > & { ordersAcceptedAfter?: string | null };
    delete legacy.ordersAcceptedAfter;

    expect(
      AfdianSponsorshipConfigSchema.parse(legacy).ordersAcceptedAfter,
    ).toBeNull();
  });

  it('rejects non-increasing thresholds', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.tiers.night_guardian.minimumAmountFen = 3_800;
    expect(AfdianSponsorshipConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejects a plan id mapped to multiple tiers', () => {
    const config = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    config.tiers.faint_light.planId = 'same-plan';
    config.tiers.fellow_traveler.planId = 'same-plan';
    expect(AfdianSponsorshipConfigSchema.safeParse(config).success).toBe(false);
  });

  it('fills the default monthly reputation when a saved tier omits it', () => {
    const legacy = structuredClone(DEFAULT_AFDIAN_SPONSORSHIP_CONFIG);
    for (const tier of SPONSORSHIP_TIER_IDS) {
      delete (legacy.tiers[tier] as { reputationPerMonth?: number })
        .reputationPerMonth;
    }
    const parsed = AfdianSponsorshipConfigSchema.parse(legacy);
    expect(parsed.tiers.faint_light.reputationPerMonth).toBe(50);
    expect(parsed.tiers.fellow_traveler.reputationPerMonth).toBe(200);
    expect(parsed.tiers.night_guardian.reputationPerMonth).toBe(400);
    expect(parsed.tiers.immortality_witness.reputationPerMonth).toBe(900);
  });

  it('multiplies the configured monthly reputation by the paid months', () => {
    expect(sponsorshipReputationGain(200, 3)).toBe(600);
    expect(sponsorshipReputationGain(900, 12)).toBe(10_800);
    expect(sponsorshipReputationGain(0, 12)).toBe(0);
    expect(sponsorshipReputationGain(200, null)).toBe(0);
    expect(sponsorshipReputationGain(200, 0)).toBe(0);
    expect(sponsorshipReputationGain(1_000_000, 3)).toBe(1_000_000);
  });

  it('uses the China calendar month for public attribution', () => {
    expect(formatSponsorshipMonth(new Date('2026-07-31T16:30:00.000Z'))).toBe(
      '2026-08',
    );
  });
});
