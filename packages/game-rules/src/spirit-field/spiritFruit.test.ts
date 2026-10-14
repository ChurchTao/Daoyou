import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@daoyou/game-content/alchemy';
import { describe, expect, it } from 'vitest';
import {
  buildCultivationBoostOperation,
  getCultivationBoostDisplayText,
} from '../consumables/cultivation-boost.js';
import { buildSpiritFruitSpec } from './spiritFruit.js';

describe('spirit fruit effect protocol', () => {
  const families = [
    'healing',
    'mana',
    'detox',
    'cultivation',
    'insight',
    'breakthrough',
    'tempering',
    'marrow_wash',
    'longevity',
    'hybrid',
  ] as const;

  it('builds an executable effect for every spirit-fruit family', () => {
    for (const family of families) {
      const spec = buildSpiritFruitSpec({ family, quality: '玄品' });
      expect(spec.operations.length).toBeGreaterThan(0);
      expect(spec.consumeRules).toEqual({
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      });
    }
  });

  it('never adds pill toxicity or pill quotas', () => {
    for (const family of families) {
      const spec = buildSpiritFruitSpec({ family, quality: '玄品' });
      expect(spec.kind).toBe('spirit_fruit');
      expect(spec.consumeRules.quotaCategory).toBe('none');
      expect(
        spec.operations.some(
          (operation) =>
            operation.type === 'change_gauge' && operation.delta > 0,
        ),
      ).toBe(false);
    }
  });

  it('uses weaker values than the same-quality pill baseline', () => {
    const longevity = buildSpiritFruitSpec({
      family: 'longevity',
      quality: '玄品',
    });
    const operation = longevity.operations[0];
    expect(operation?.type).toBe('increase_lifespan');
    if (operation?.type === 'increase_lifespan') {
      expect(operation.value).toBeLessThan(
        ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.lifespan,
      );
    }

    const healing = buildSpiritFruitSpec({
      family: 'healing',
      quality: '玄品',
    }).operations[0];
    expect(healing?.type).toBe('restore_resource');
    if (healing?.type === 'restore_resource') {
      expect(healing.value).toBeLessThan(
        ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.restorePercent,
      );
    }

    const insight = buildSpiritFruitSpec({
      family: 'insight',
      quality: '玄品',
    }).operations[0];
    expect(insight?.type).toBe('gain_progress');
    if (insight?.type === 'gain_progress') {
      expect(insight.value).toBeLessThan(
        ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.insight,
      );
    }
  });

  it('buffs the next retreat instead of granting flat cultivation', () => {
    const fruit = buildSpiritFruitSpec({
      family: 'cultivation',
      quality: '神品',
    });
    const operation = buildCultivationBoostOperation('神品', 0.8);

    expect(fruit.operations).toEqual([operation]);
    expect(getCultivationBoostDisplayText(operation)).toBe(
      '下次闭关修为 +640%',
    );
    expect(
      fruit.operations.some(
        (entry) =>
          entry.type === 'gain_progress' && entry.target === 'cultivation_exp',
      ),
    ).toBe(false);
  });
});
