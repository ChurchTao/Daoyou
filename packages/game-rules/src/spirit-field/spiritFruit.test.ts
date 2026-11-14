import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@daoyou/game-content/alchemy';
import { SPIRIT_GARDEN_SPECIES } from '@daoyou/game-content/spirit-field/config';
import type { ConditionOperation } from '@daoyou/game-domain/consumables';
import { assertConsumableSpec } from '@daoyou/game-domain/consumables';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import type { SpiritGardenFruitEffect } from '@daoyou/game-domain/spirit-field';
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

  it('keeps single-effect configured fruits identical to the existing single-fruit strengths at every quality', () => {
    for (const quality of QUALITY_VALUES)
      for (const family of [
        ...families.filter((family) => family !== 'hybrid'),
        'beast_cultivation',
      ] as const) {
        const legacy = buildSpiritFruitSpec({ family, quality });
        const configured = buildSpiritFruitSpec({
          quality,
          effects: [{ family, share: 1 }],
        });
        expect(configured).toEqual(legacy);
      }
  });

  it('splits one existing fruit budget between effects instead of stacking full-strength effects', () => {
    for (const quality of QUALITY_VALUES) {
      const fullHealing = buildSpiritFruitSpec({ quality, family: 'healing' })
        .operations[0]!;
      const fullMana = buildSpiritFruitSpec({ quality, family: 'mana' })
        .operations[0]!;
      const combined = buildSpiritFruitSpec({
        quality,
        effects: [
          { family: 'healing', share: 0.6 },
          { family: 'mana', share: 0.4 },
        ],
      });
      expect(combined.family).toBe('hybrid');
      expect(combined.operations).toHaveLength(2);
      const [healing, mana] = combined.operations;
      if (
        fullHealing.type !== 'restore_resource' ||
        fullMana.type !== 'restore_resource' ||
        healing?.type !== 'restore_resource' ||
        mana?.type !== 'restore_resource'
      )
        throw new Error('Expected restoration operations');
      expect(healing.value).toBeLessThanOrEqual(fullHealing.value * 0.6 + 1e-8);
      expect(mana.value).toBeLessThanOrEqual(fullMana.value * 0.4 + 1e-8);
      expect(
        healing.value / fullHealing.value + mana.value / fullMana.value,
      ).toBeLessThanOrEqual(1 + 1e-8);
      expect(healing.value + mana.value).toBeLessThan(
        ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].restorePercent,
      );
    }
  });

  it('scales progress and one-use status payloads without adding cultivation directly or mutating input', () => {
    const effects: SpiritGardenFruitEffect[] = [
      { family: 'cultivation', share: 0.5 },
      { family: 'insight', share: 0.5 },
    ];
    const before = structuredClone(effects);
    const combined = buildSpiritFruitSpec({ quality: '神品', effects });
    expect(combined.operations).toContainEqual({
      type: 'add_status',
      status: 'cultivation_boost',
      usesRemaining: 1,
      payload: { boostPercent: 3.2, retreatExpMultiplier: 4.2 },
    });
    const insight = combined.operations.find(
      (operation) => operation.type === 'gain_progress',
    );
    const fullInsight = buildSpiritFruitSpec({
      quality: '神品',
      family: 'insight',
    }).operations[0]!;
    if (
      insight?.type !== 'gain_progress' ||
      fullInsight.type !== 'gain_progress'
    )
      throw new Error('Expected insight operations');
    expect(insight.value).toBe(Math.floor(fullInsight.value * 0.5));
    expect(
      combined.operations.some(
        (operation) =>
          operation.type === 'gain_progress' &&
          operation.target === 'cultivation_exp',
      ),
    ).toBe(false);
    expect(effects).toEqual(before);
  });

  it('rejects over-budget, repeated, nested and mixed-target effects', () => {
    const invalid = [
      [],
      [
        { family: 'healing', share: 1 },
        { family: 'mana', share: 1 },
      ],
      [{ family: 'healing', share: 0.4 }],
      [
        { family: 'healing', share: 0.5 },
        { family: 'healing', share: 0.5 },
      ],
      [
        { family: 'healing', share: -0.1 },
        { family: 'mana', share: 1.1 },
      ],
      [{ family: 'hybrid', share: 1 }],
      [
        { family: 'beast_cultivation', share: 0.5 },
        { family: 'healing', share: 0.5 },
      ],
      [{ family: 'made-up-effect', share: 1 }],
      [
        { family: 'insight', share: 0.01 },
        { family: 'healing', share: 0.99 },
      ],
    ];
    for (const effects of invalid)
      expect(() =>
        buildSpiritFruitSpec({
          quality: '玄品',
          effects: effects as SpiritGardenFruitEffect[],
        }),
      ).toThrow();
    expect(() =>
      buildSpiritFruitSpec({
        quality: '玄品',
        family: 'healing',
        effects: [{ family: 'mana', share: 1 }],
      }),
    ).toThrow();
    expect(() => buildSpiritFruitSpec({ quality: '玄品' })).toThrow();
  });

  it('builds executable configured fruits for every native species and its one-quality evolution', () => {
    const magnitude = (operation: ConditionOperation) => {
      if (operation.type === 'add_status')
        return operation.status === 'cultivation_boost'
          ? Number(operation.payload?.boostPercent)
          : Number(operation.payload?.breakthroughChanceBonus);
      if (operation.type === 'change_gauge') return Math.abs(operation.delta);
      if ('value' in operation) return operation.value;
      throw new Error('Unexpected fruit operation');
    };
    for (const species of SPIRIT_GARDEN_SPECIES) {
      const output = species.branches.essence.output;
      if (output.kind !== 'spirit_fruit') continue;
      for (const quality of QUALITY_VALUES.slice(
        QUALITY_VALUES.indexOf(species.quality),
        QUALITY_VALUES.indexOf(species.quality) + 2,
      )) {
        const spec = buildSpiritFruitSpec({
          quality,
          family: output.fruitFamily,
          effects: output.fruitEffects,
        });
        expect(() => assertConsumableSpec(spec)).not.toThrow();
        expect(spec.operations.length).toBeGreaterThan(0);
        expect(spec.consumeRules.quotaCategory).toBe('none');
        expect(() =>
          ConsumableFactsSchema.parse({
            name: output.name,
            type: '灵果',
            quality,
            description: output.description,
            spec,
          }),
        ).not.toThrow();
        let budget = 0;
        for (const [index, effect] of (output.fruitEffects ?? []).entries()) {
          const baseline = buildSpiritFruitSpec({
            quality,
            family: effect.family,
          }).operations[0]!;
          const value = magnitude(spec.operations[index]!);
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThanOrEqual(
            magnitude(baseline) * effect.share + 1e-8,
          );
          budget += value / magnitude(baseline);
        }
        expect(budget).toBeLessThanOrEqual(1 + 1e-8);
      }
    }
  });
});
