import { describe, expect, it } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import { buildRetreatEfficiencyModel } from './retreatEfficiency';

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    spirit_stones: 0,
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    cultivation_progress: {
      cultivation_exp: 100,
      exp_cap: 10_000,
      comprehension_insight: 30,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    condition: {
      version: 1,
      resources: {
        hp: { current: 100 },
        mp: { current: 100 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    },
    ...overrides,
  } as Cultivator;
}

function withCultivationBoost(cultivator: Cultivator): Cultivator {
  return {
    ...cultivator,
    condition: {
      ...cultivator.condition!,
      statuses: [
        {
          key: 'cultivation_boost',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          usesRemaining: 1,
          payload: {
            boostPercent: 0.5,
            retreatExpMultiplier: 1.5,
          },
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    },
  };
}

function withBreakthroughFocus(cultivator: Cultivator): Cultivator {
  return {
    ...cultivator,
    condition: {
      ...cultivator.condition!,
      statuses: [
        {
          key: 'breakthrough_focus',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          usesRemaining: 1,
          payload: {
            breakthroughChanceBonus: 0.126,
          },
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    },
  };
}

describe('buildRetreatEfficiencyModel', () => {
  it('shows cultivation boost as a one-retreat bonus', () => {
    const model = buildRetreatEfficiencyModel({
      cultivator: withCultivationBoost(createCultivator()),
      retreatYears: '10',
    });

    expect(model.hasCultivationBoost).toBe(true);
    expect(model.retreatTags).toContainEqual({
      key: 'cultivation_boost',
      icon: '🌿',
      label: '养元',
      value: '+50%',
      tone: 'positive',
    });
  });

  it('does not add a cultivation boost tag when no boost is active', () => {
    const model = buildRetreatEfficiencyModel({
      cultivator: createCultivator(),
      retreatYears: '10',
    });

    expect(model.hasCultivationBoost).toBe(false);
    expect(
      model.retreatTags.some((tag) => tag.key === 'cultivation_boost'),
    ).toBe(false);
    expect(model.emptyHint).toContain('未见养元药力');
  });

  it('only adds positive fate retreat tags', () => {
    const positive = buildRetreatEfficiencyModel({
      cultivator: createCultivator({
        pre_heaven_fates: [
          {
            id: 'fate-positive',
            name: '通幽',
            quality: '玄品',
            description: '',
            effects: [
              {
                label: '闭关修为提升',
                effectType: 'retreat_exp_multiplier',
                value: 1.2,
              },
            ],
          },
        ],
      } as Partial<Cultivator>),
      retreatYears: '10',
    });
    const negative = buildRetreatEfficiencyModel({
      cultivator: createCultivator({
        pre_heaven_fates: [
          {
            id: 'fate-negative',
            name: '乱息',
            quality: '凡品',
            description: '',
            effects: [
              {
                label: '闭关修为降低',
                effectType: 'retreat_exp_multiplier',
                value: 0.8,
              },
            ],
          },
        ],
      } as Partial<Cultivator>),
      retreatYears: '10',
    });

    expect(positive.retreatTags).toContainEqual({
      key: 'fate_retreat_exp',
      icon: '🌕',
      label: '静修命格',
      value: '+20%',
      tone: 'positive',
    });
    expect(
      negative.retreatTags.some((tag) => tag.key === 'fate_retreat_exp'),
    ).toBe(false);
  });

  it('surfaces bottleneck as a warning tag', () => {
    const model = buildRetreatEfficiencyModel({
      cultivator: createCultivator({
        cultivation_progress: {
          cultivation_exp: 9_000,
          exp_cap: 10_000,
          comprehension_insight: 30,
          breakthrough_failures: 0,
          bottleneck_state: true,
          inner_demon: false,
          deviation_risk: 0,
        },
      }),
      retreatYears: '10',
    });

    expect(model.retreatTags).toContainEqual({
      key: 'bottleneck',
      icon: '⛰️',
      label: '瓶颈',
      value: '闭关放缓',
      tone: 'warning',
    });
  });

  it('shows breakthrough focus as a compact buff tag', () => {
    const model = buildRetreatEfficiencyModel({
      cultivator: withBreakthroughFocus(createCultivator()),
      retreatYears: '10',
    });

    expect(model.breakthroughTags).toContainEqual({
      key: 'breakthrough_focus',
      icon: '🕯️',
      label: '破境凝神',
      value: '+12.6%',
      tone: 'positive',
    });
  });
});
