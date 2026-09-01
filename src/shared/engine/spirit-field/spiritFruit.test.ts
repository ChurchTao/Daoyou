import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { describe, expect, it } from 'vitest';
import { buildSpiritFruitSpec } from './spiritFruit';

describe('spirit fruit effect protocol', () => {
  it('never adds pill toxicity or pill quotas', () => {
    for (const family of ['healing', 'mana', 'longevity', 'marrow_wash', 'breakthrough'] as const) {
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
  });
});
