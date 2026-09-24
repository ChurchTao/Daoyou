import { describe, expect, it } from 'vitest';
import {
  isSystemMailInWindow,
  matchesSystemMailConditions,
  SystemMailConditionsSchema,
  SystemMailInputSchema,
  type SystemMailAudienceSnapshot,
} from './systemMail';

const publishedAt = '2026-09-23T00:00:00Z';
const facts: SystemMailAudienceSnapshot = {
  cultivatorId: 'c30a7119-1f9f-4305-8696-0a60064d1810',
  createdAt: '2026-09-20T00:00:00Z',
  realm: { realm: '筑基', stage: '中期' },
  highestSponsorshipTier: 'night_guardian',
  checkedAt: publishedAt,
};
const matches = (conditions: unknown, actor = facts) =>
  matchesSystemMailConditions(
    SystemMailConditionsSchema.parse(conditions),
    actor,
    publishedAt,
  );

describe('system mail eligibility', () => {
  it('includes both realm bounds, including minor stages', () => {
    const conditions = {
      realmMin: facts.realm,
      realmMax: { realm: '金丹', stage: '初期' },
    };
    expect(matches(conditions)).toBe(true);
    expect(
      matches(conditions, {
        ...facts,
        realm: { realm: '筑基', stage: '初期' },
      }),
    ).toBe(false);
    expect(
      matches(conditions, {
        ...facts,
        realm: { realm: '金丹', stage: '初期' },
      }),
    ).toBe(true);
    expect(
      matches(conditions, {
        ...facts,
        realm: { realm: '金丹', stage: '中期' },
      }),
    ).toBe(false);
  });
  it('combines target, creation, realm and sponsorship with AND', () => {
    const conditions = {
      targetCultivatorId: facts.cultivatorId,
      createdBeforePublication: true,
      realmMin: facts.realm,
      sponsorship: { mode: 'at_least', tiers: ['fellow_traveler'] },
    };
    expect(matches(conditions)).toBe(true);
    expect(
      matches(conditions, {
        ...facts,
        cultivatorId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(false);
    expect(matches(conditions, { ...facts, createdAt: publishedAt })).toBe(
      false,
    );
    expect(
      matches(conditions, { ...facts, highestSponsorshipTier: null }),
    ).toBe(false);
    expect(
      matches(conditions, { ...facts, highestSponsorshipTier: 'faint_light' }),
    ).toBe(false);
  });
  it('treats sponsor selections as OR, without treating missing profiles as sponsors', () => {
    const conditions = {
      sponsorship: { mode: 'one_of', tiers: ['faint_light', 'night_guardian'] },
    };
    expect(matches(conditions)).toBe(true);
    expect(
      matches(conditions, {
        ...facts,
        highestSponsorshipTier: 'immortality_witness',
      }),
    ).toBe(false);
    expect(
      matches(conditions, { ...facts, highestSponsorshipTier: null }),
    ).toBe(false);
    expect(matches({}, { ...facts, highestSponsorshipTier: null })).toBe(true);
  });
  it('uses inclusive creation start and exclusive end with explicit timezone', () => {
    expect(matches({ createdFrom: '2026-09-20T08:00:00+08:00' })).toBe(true);
    expect(matches({ createdBefore: facts.createdAt })).toBe(false);
  });
  it('allows a later snapshot to qualify after initially failing', () => {
    const conditions = { realmMin: { realm: '金丹', stage: '初期' } };
    expect(matches(conditions)).toBe(false);
    expect(
      matches(conditions, {
        ...facts,
        realm: { realm: '金丹', stage: '初期' },
      }),
    ).toBe(true);
  });
  it('rejects invalid ranges, ambiguous dates, and removed audience fields', () => {
    expect(
      SystemMailConditionsSchema.safeParse({
        realmMin: { realm: '金丹', stage: '初期' },
        realmMax: facts.realm,
      }).success,
    ).toBe(false);
    expect(
      SystemMailConditionsSchema.safeParse({
        createdFrom: publishedAt,
        createdBefore: publishedAt,
      }).success,
    ).toBe(false);
    expect(
      SystemMailConditionsSchema.safeParse({ createdFrom: '2026-09-23' })
        .success,
    ).toBe(false);
    expect(
      SystemMailConditionsSchema.safeParse({ lastActiveAt: publishedAt })
        .success,
    ).toBe(false);
    expect(
      SystemMailConditionsSchema.safeParse({
        sponsorship: {
          mode: 'at_least',
          tiers: ['faint_light', 'night_guardian'],
        },
      }).success,
    ).toBe(false);
  });
});

describe('system mail delivery window', () => {
  const campaign = {
    publishedAt,
    startsAt: '2026-09-24T00:00:00Z',
    endsAt: '2026-09-25T00:00:00Z',
  };
  it('does not admit checks before publication or start, or at the exclusive end', () => {
    expect(isSystemMailInWindow(campaign, publishedAt)).toBe(false);
    expect(isSystemMailInWindow(campaign, campaign.startsAt)).toBe(true);
    expect(isSystemMailInWindow(campaign, campaign.endsAt)).toBe(false);
    expect(
      isSystemMailInWindow(
        { ...campaign, startsAt: '2026-09-01T00:00:00Z' },
        '2026-09-22T00:00:00Z',
      ),
    ).toBe(false);
  });
  it('uses the original check timestamp, independent of later processing time', () => {
    expect(isSystemMailInWindow(campaign, '2026-09-24T23:59:59.999Z')).toBe(
      true,
    );
  });
  it('validates publication contents and rejects the removed dry-run field', () => {
    const input = {
      title: '补偿',
      content: '维护奖励',
      rewardSelections: [],
      conditions: {},
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
    };
    expect(SystemMailInputSchema.safeParse(input).success).toBe(true);
    expect(
      SystemMailInputSchema.safeParse({ ...input, endsAt: input.startsAt })
        .success,
    ).toBe(false);
    expect(
      SystemMailInputSchema.safeParse({ ...input, dryRun: true }).success,
    ).toBe(false);
  });
});
