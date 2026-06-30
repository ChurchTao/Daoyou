import { describe, expect, it } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import { QUALITY_ORDER } from '@shared/types/constants';
import { FateEngine } from './FateEngine';

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createSequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

const buildCultivator = (
  overrides: Partial<Cultivator> = {},
): Cultivator => ({
  id: 'c1',
  name: '韩立',
  gender: '男',
  realm: '炼气',
  realm_stage: '初期',
  age: 18,
  lifespan: 100,
  status: 'active',
  attributes: {
    vitality: 20,
    spirit: 18,
    wisdom: 22,
    speed: 19,
    willpower: 21,
  },
  spiritual_roots: [
    { element: '金', strength: 82, grade: '真灵根' },
    { element: '木', strength: 40, grade: '伪灵根' },
  ],
  pre_heaven_fates: [],
  cultivations: [],
  skills: [],
  inventory: {
    artifacts: [],
    consumables: [],
    materials: [],
  },
  equipped: {
    weapon: null,
    armor: null,
    accessory: null,
  },
  spirit_stones: 0,
  prompt: '寒门修士，想稳扎稳打地闭关冲关',
  ...overrides,
});

describe('FateEngine', () => {
  it('generates six candidates and keeps only three selected fates', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: createSeededRng(7),
    });

    expect(pool).toHaveLength(6);
    expect(FateEngine.getSelectedFates(pool)).toHaveLength(3);
  });

  it('uses the new single-effect model and allows at most one dual-sided fate per roll', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: createSeededRng(19),
    });

    const dualSided = pool.filter(
      (fate) => fate.generationModel?.category === 'dual_sided',
    );
    expect(dualSided.length).toBeLessThanOrEqual(1);

    for (const fate of pool) {
      const effects = fate.effects ?? [];
      if (fate.generationModel?.category === 'dual_sided') {
        expect(fate.quality).toBeTruthy();
        expect(
          QUALITY_ORDER[fate.quality ?? '凡品'],
        ).toBeGreaterThanOrEqual(QUALITY_ORDER['天品']);
        expect(effects).toHaveLength(2);
        expect(effects[0]?.polarity).toBe('boon');
        expect(effects[1]?.polarity).toBe('burden');
        expect(effects[0]?.effectId).not.toBe(effects[1]?.effectId);
      } else {
        expect(effects).toHaveLength(1);
        expect(effects[0]?.polarity).toBe('boon');
      }

      expect(fate.name).toMatch(/^[\u4e00-\u9fff]{4,5}$/);
      expect(fate.namingMetadata).toBeUndefined();
    }
  });

  it('rolls persisted values inside the quality range and does not emit removed effect types', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: createSeededRng(31),
    });
    const allowedEffectTypes = new Set([
      'retreat_exp_multiplier',
      'retreat_insight_multiplier',
      'breakthrough_bonus',
      'natural_recovery_multiplier',
      'toxicity_penalty_multiplier',
      'alchemy_spirit_stone_multiplier',
      'refine_spirit_stone_multiplier',
      'enlightenment_insight_multiplier',
      'inn_cultivation_loss_multiplier',
      'system_spirit_stone_multiplier',
      'market_purchase_price_multiplier',
    ]);

    for (const effect of pool.flatMap((fate) => fate.effects ?? [])) {
      expect(effect.value).toBeGreaterThanOrEqual(effect.rollMeta.minValue);
      expect(effect.value).toBeLessThanOrEqual(effect.rollMeta.maxValue);
      expect(allowedEffectTypes.has(effect.effectType)).toBe(true);
    }
  });

  it('does not use prompt text to weight effect selection', async () => {
    const neutralPool = await FateEngine.generateCandidatePool(
      buildCultivator({ prompt: '寻常散修' }),
      { rng: createSeededRng(9) },
    );
    const alchemyPool = await FateEngine.generateCandidatePool(
      buildCultivator({ prompt: '偏爱炼丹、调息、化解丹毒' }),
      { rng: createSeededRng(9) },
    );

    expect(alchemyPool).toEqual(neutralPool);
  });

  it('rolls quality before effect from the full quality table', async () => {
    const pool = await FateEngine.generateCandidatePool(buildCultivator(), {
      rng: createSequenceRng([
        0.999,
        0,
        0.999,
        0.5,
        0.1,
        0.2,
        0.9,
        0.5,
        0.2,
        0.3,
        0.9,
        0.5,
      ]),
    });

    expect(pool[0]?.quality).toBe('神品');
    expect(pool[0]?.effects?.[0]?.effectId).toBe('retreat-exp-gain');
  });
});
