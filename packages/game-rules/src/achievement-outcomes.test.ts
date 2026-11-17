import { BEAST_SKILLS, BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { daoEquipmentTemplateOf } from '@daoyou/game-content/equipment/base';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import type { DaoEquipmentInstanceV1 } from '@daoyou/game-domain/equipment';
import { describe, expect, it } from 'vitest';
import {
  alchemyAchievementMetrics,
  forgingAchievementMetrics,
  fusionAchievementMetrics,
  productionAchievementMetrics,
} from './achievement-outcomes.js';
import { eligibleAchievementIds } from './achievements.js';
import { rollAlchemyYieldProfile } from './alchemy/alchemyYield.js';
import { generateStarterBeast } from './beasts/generator.js';
import { generateForgedEquipment } from './equipment/forging.js';
import { daoEquipmentBaseRange } from './equipment/ranges.js';

function equipment(level = 90): DaoEquipmentInstanceV1 {
  const generated = generateForgedEquipment({
    id: 'test-forge',
    createdAt: '2026-11-17T00:00:00.000Z',
    seed: 12,
    templateId: 'dao_equipment.standard.weapon.v1',
    equipmentLevel: level,
    baseQuality: 1,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!generated.ok) throw new Error('invalid fixture');
  return {
    ...generated.instance,
    essenceIds: [],
    artId: undefined,
    attributeBonuses: [],
  };
}
const maxMetrics = (...records: Record<string, number>[]) =>
  records.reduce(
    (all, record) => {
      for (const [key, value] of Object.entries(record))
        all[key] = Math.max(all[key] ?? 0, value);
      return all;
    },
    {} as Record<string, number>,
  );
const pill = (
  quantity: number,
  quality: '玄品' | '地品' | '天品' | '仙品' | '灵品' = '玄品',
  appearance: 'perfect' | 'high' = 'perfect',
) => ({ quantity, quality, appearance });
const batch = (...lots: ReturnType<typeof pill>[]) => ({
  lots,
  totalQuantity: lots.reduce((n, lot) => n + lot.quantity, 0),
});
const beast = (): SummonedBeast =>
  generateStarterBeast(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    BEAST_SPECIES[0].id,
    1,
  );
const skillIds = BEAST_SKILLS.slice(0, 16).map((skill) => skill.id);

describe('single forging outcomes', () => {
  it('reads a complete forging receipt and rejects incomplete or unknown historical equipment', () => {
    const item = equipment();
    expect(
      productionAchievementMetrics('forging', { equipment: item }),
    ).toEqual(forgingAchievementMetrics(item));
    expect(
      productionAchievementMetrics('forging', {
        equipment: { equipmentLevel: 170, essenceIds: ['a'] },
      }),
    ).toBeNull();
    expect(
      productionAchievementMetrics('forging', {
        equipment: { ...item, templateId: 'retired.template' },
      }),
    ).toBeNull();
  });
  it('does not combine blue letters from a low-level item with a different high-level item', () => {
    const low = forgingAchievementMetrics({
      ...equipment(50),
      essenceIds: ['a', 'b'],
      artId: 'art',
    });
    const high = forgingAchievementMetrics(equipment(170));
    const ids = eligibleAchievementIds({ metrics: maxMetrics(low, high) });
    expect(ids).toContain('forging.blue_level.50');
    expect(ids).not.toContain('forging.blue_level.170');
    expect(ids).not.toContain('forging.high_triple_blue');
    expect(ids).not.toContain('forging.triple_blue');
  });
  it('counts essences and arts, separately from attribute bonuses and inscriptions', () => {
    const item = equipment();
    expect(
      forgingAchievementMetrics({
        ...item,
        attributeBonuses: [
          { attr: 'strength', value: 10 },
          { attr: 'spirit', value: 10 },
        ],
      })['forging.blue_level'],
    ).toBe(0);
    expect(
      forgingAchievementMetrics({ ...item, artId: 'art' })[
        'forging.blue_level'
      ],
    ).toBe(90);
    expect(
      forgingAchievementMetrics({ ...item, essenceIds: ['a', 'a'] })[
        'forging.double_essence'
      ],
    ).toBe(0);
    expect(
      forgingAchievementMetrics({ ...item, essenceIds: ['a', 'b'] })[
        'forging.double_essence'
      ],
    ).toBe(1);
  });
  it('requires both kinds of blue letter on the same item', () => {
    const item = equipment(150);
    const one = forgingAchievementMetrics({ ...item, essenceIds: ['a', 'b'] });
    const two = forgingAchievementMetrics({ ...item, artId: 'art' });
    expect(maxMetrics(one, two)['forging.essence_art']).toBe(0);
    expect(
      forgingAchievementMetrics({
        ...item,
        essenceIds: ['a', 'b'],
        artId: 'art',
      }),
    ).toMatchObject({
      'forging.essence_art': 1,
      'forging.triple_blue': 1,
      'forging.high_triple_blue': 1,
    });
  });
  it('restricts double attributes to weapon or armor and still requires a blue letter', () => {
    const item = {
      ...equipment(),
      essenceIds: ['a'],
      attributeBonuses: [
        { attr: 'strength' as const, value: 10 },
        { attr: 'spirit' as const, value: 10 },
      ],
    };
    expect(forgingAchievementMetrics(item)['forging.double_bonus_blue']).toBe(
      1,
    );
    expect(
      forgingAchievementMetrics({ ...item, slot: 'head' })[
        'forging.double_bonus_blue'
      ],
    ).toBe(0);
    expect(
      forgingAchievementMetrics({ ...item, essenceIds: [] })[
        'forging.double_bonus_blue'
      ],
    ).toBe(0);
  });
  it('requires every base roll at the top-decile boundary of the exact weapon ranges', () => {
    const item = equipment();
    const template = daoEquipmentTemplateOf(item.templateId)!;
    item.baseStats = template.baseStats.map((rule) => {
      const range = daoEquipmentBaseRange(
        rule,
        item.equipmentLevel,
        1,
        item.weaponType,
      );
      return {
        attr: rule.attr,
        value: Math.ceil(range.min + (range.max - range.min) * 0.9),
      };
    });
    expect(forgingAchievementMetrics(item)['forging.flawless_base']).toBe(1);
    expect(
      forgingAchievementMetrics({ ...item, baseQuality: 0.99 })[
        'forging.flawless_base'
      ],
    ).toBe(0);
    expect(
      forgingAchievementMetrics({ ...item, baseStats: [] })[
        'forging.flawless_base'
      ],
    ).toBe(0);
    item.baseStats[0].value--;
    expect(forgingAchievementMetrics(item)['forging.flawless_base']).toBe(0);
  });
});

describe('single alchemy batch outcomes', () => {
  it('counts quantities across qualifying lots, but not low quality or non-perfect pills', () => {
    expect(
      alchemyAchievementMetrics(
        batch(
          pill(5),
          pill(1, '地品'),
          pill(50, '仙品', 'high'),
          pill(50, '灵品'),
        ),
      ),
    ).toMatchObject({
      'alchemy.perfect_batch': 6,
      'alchemy.perfect_quality': 4,
      'alchemy.full_perfect': 0,
      'alchemy.three_perfect_qualities': 0,
    });
  });
  it('never combines quantities, qualities, or perfect status from different furnaces', () => {
    const first = alchemyAchievementMetrics(batch(pill(10), pill(1, '地品')));
    const second = alchemyAchievementMetrics(
      batch(pill(10, '天品'), pill(30, '仙品', 'high')),
    );
    const maxima = maxMetrics(first, second);
    expect(maxima['alchemy.perfect_batch']).toBe(11);
    expect(maxima['alchemy.perfect_quality']).toBe(5);
    expect(maxima['alchemy.three_perfect_qualities']).toBe(0);
    expect(eligibleAchievementIds({ metrics: maxima })).not.toContain(
      'alchemy.perfect_batch.18',
    );
  });
  it.each([17, 18, 19])(
    'requires an entire qualifying perfect batch of 18 pills: %i',
    (quantity) => {
      expect(
        alchemyAchievementMetrics(batch(pill(quantity)))[
          'alchemy.full_perfect'
        ],
      ).toBe(Number(quantity >= 18));
      expect(
        alchemyAchievementMetrics(batch(pill(quantity), pill(1, '灵品')))[
          'alchemy.full_perfect'
        ],
      ).toBe(0);
      expect(
        alchemyAchievementMetrics(
          batch(pill(quantity), pill(1, '玄品', 'high')),
        )['alchemy.full_perfect'],
      ).toBe(0);
    },
  );
  it('requires three distinct qualifying perfect qualities in the same furnace', () => {
    expect(
      alchemyAchievementMetrics(
        batch(pill(1), pill(1, '地品'), pill(1, '天品')),
      )['alchemy.three_perfect_qualities'],
    ).toBe(1);
    expect(
      alchemyAchievementMetrics(batch(pill(1), pill(1), pill(1, '地品')))[
        'alchemy.three_perfect_qualities'
      ],
    ).toBe(0);
    expect(
      alchemyAchievementMetrics(
        batch(pill(1), pill(1, '地品'), pill(1, '天品', 'high')),
      )['alchemy.three_perfect_qualities'],
    ).toBe(0);
  });
  it('rejects partial totals, fractional, negative, excessive and invalid-quality output', () => {
    for (const result of [
      { totalQuantity: 20, lots: [pill(6)] },
      { totalQuantity: 0, lots: [pill(-1)] },
      { totalQuantity: 1.5, lots: [pill(1.5)] },
      { totalQuantity: 1000, lots: [pill(1000)] },
      {
        totalQuantity: 1,
        lots: [{ quantity: 1, quality: 'unknown', appearance: 'perfect' }],
      },
    ])
      expect(
        productionAchievementMetrics('alchemy_formula', {
          yieldProfile: result,
        }),
      ).toBeNull();
    expect(alchemyAchievementMetrics(batch())['alchemy.full_perfect']).toBe(0);
  });
  it('does not infer an entire historical furnace from a display pill or current bag', () => {
    expect(
      productionAchievementMetrics('alchemy_formula', { consumable: pill(72) }),
    ).toBeNull();
    expect(
      productionAchievementMetrics('purchase', {
        yieldProfile: batch(pill(72)),
      }),
    ).toBeNull();
    expect(
      productionAchievementMetrics('alchemy_formula', {
        yieldProfile: batch(pill(72)),
      })?.['alchemy.perfect_batch'],
    ).toBe(72);
  });
  it('keeps calibrated tiers reachable within six legal material slots without changing yield rules', () => {
    const factors = { purity: 0.8, stability: 80, synergyScore: 0.6 };
    const singleHerb = rollAlchemyYieldProfile({
      materials: [{ rank: '玄品', type: 'herb', dose: 30 }],
      factors,
      rng: () => 0.999,
    });
    const singleTreasure = rollAlchemyYieldProfile({
      materials: [{ rank: '玄品', type: 'tcdb', dose: 30 }],
      factors,
      rng: () => 0.999,
    });
    const twoTreasures = rollAlchemyYieldProfile({
      materials: [
        { rank: '玄品', type: 'tcdb', dose: 30 },
        { rank: '玄品', type: 'tcdb', dose: 30 },
      ],
      factors,
      rng: () => 0.999,
    });
    expect(alchemyAchievementMetrics(singleHerb)['alchemy.perfect_batch']).toBe(
      19,
    );
    expect(
      alchemyAchievementMetrics(singleTreasure)['alchemy.perfect_batch'],
    ).toBe(49);
    expect(
      alchemyAchievementMetrics(twoTreasures)['alchemy.perfect_batch'],
    ).toBe(99);
    expect(
      eligibleAchievementIds({
        metrics: alchemyAchievementMetrics(singleTreasure),
      }),
    ).not.toContain('alchemy.perfect_batch.72');
    expect(
      eligibleAchievementIds({
        metrics: alchemyAchievementMetrics(twoTreasures),
      }),
    ).toContain('alchemy.perfect_batch.72');
  });
});

describe('single fusion outcomes', () => {
  const parents = (): [SummonedBeast, SummonedBeast] => [
    { ...beast(), skills: skillIds.slice(0, 6) },
    { ...beast(), skills: skillIds.slice(4, 10) },
  ];
  it('requires skill count and growth on the same fused beast', () => {
    const p = parents();
    const highGrowth = fusionAchievementMetrics(p, {
      ...beast(),
      skills: skillIds.slice(0, 7),
      growth: 1.4,
    });
    const highSkills = fusionAchievementMetrics(p, {
      ...beast(),
      skills: skillIds.slice(0, 12),
      growth: 1.299,
    });
    expect(maxMetrics(highGrowth, highSkills)['beasts.fusion_talented']).toBe(
      0,
    );
    expect(
      fusionAchievementMetrics(p, {
        ...beast(),
        skills: skillIds.slice(0, 8),
        growth: 1.3,
      })['beasts.fusion_talented'],
    ).toBe(1);
    expect(
      fusionAchievementMetrics(p, {
        ...beast(),
        skills: skillIds.slice(0, 12),
        growth: 1.4,
      })['beasts.fusion_excellent'],
    ).toBe(1);
  });
  it('requires the actual union of ten parental skills, not the resulting count', () => {
    const p = parents();
    expect(
      fusionAchievementMetrics(p, {
        ...beast(),
        skills: skillIds.slice(0, 10),
      })['beasts.fusion_inherited'],
    ).toBe(1);
    expect(
      fusionAchievementMetrics(p, {
        ...beast(),
        skills: skillIds.slice(1, 12),
      })['beasts.fusion_inherited'],
    ).toBe(0);
    expect(
      fusionAchievementMetrics([p[0], p[0]], { ...beast(), skills: skillIds })[
        'beasts.fusion_inherited'
      ],
    ).toBe(0);
  });
  it('compares all five raw aptitudes strictly against the stronger parent for that attribute', () => {
    const p = parents();
    p[1].aptitudes.attack += 100;
    const result = { ...beast(), aptitudes: { ...beast().aptitudes } };
    for (const key of ['attack', 'defense', 'health', 'mana', 'speed'] as const)
      result.aptitudes[key] =
        Math.max(p[0].aptitudes[key], p[1].aptitudes[key]) + 1;
    expect(fusionAchievementMetrics(p, result)['beasts.fusion_surpassed']).toBe(
      1,
    );
    result.aptitudes.speed--;
    expect(fusionAchievementMetrics(p, result)['beasts.fusion_surpassed']).toBe(
      0,
    );
  });
});
