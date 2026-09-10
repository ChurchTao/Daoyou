import { BLUEPRINTS } from '@shared/items/definitions/equipment-blueprints';
import { QINGXI_EQUIPMENT_LEVELS } from '@shared/rewards/wild';
import {
  QUALITY_ORDER,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  SECT_REALM_QUALITY_RULES,
  STANDARD_SECT_TASK_REQUIREMENT_CURVE,
  SectEquipmentDeliveryRequirementSchema,
  SectTaskRandomSource,
  assertSectRealmQualityRules,
  assertStandardSectTaskRequirementCurve,
  calculateSectDeliveryDifficulty,
  describeSectDeliveryRequirement,
  formatSectDeliveryRequirement,
  generateSectDeliveryRequirement,
  pickSectTaskMinimumQuality,
} from './taskRequirements';

describe('sect task requirement generation', () => {
  it('centralizes requirement generation and difficulty tuning', () => {
    expect(() => assertStandardSectTaskRequirementCurve()).not.toThrow();
    expect(STANDARD_SECT_TASK_REQUIREMENT_CURVE).toMatchObject({
      quantity: {
        pill: 1,
        equipment: 1,
        material: {
          min: 1,
          max: 3,
          highQuality: 1,
          highQualityThreshold: '地品',
        },
      },
      pillAppearanceWeights: [
        { grade: 'low', weight: 30 },
        { grade: 'middle', weight: 45 },
        { grade: 'high', weight: 20 },
        { grade: 'perfect', weight: 5 },
      ],
      optionalConditionChance: {
        materialElement: 0.35,
      },
      difficulty: {
        qualityScoreMultiplier: 2,
        maximumScore: { easy: 3, normal: 6, hard: 10 },
      },
    });
  });

  it('validates explicit realm quality weights', () => {
    expect(() => assertSectRealmQualityRules()).not.toThrow();
    for (const rule of Object.values(SECT_REALM_QUALITY_RULES))
      expect(
        Object.values(rule.weights).reduce(
          (sum, value) => sum + (value ?? 0),
          0,
        ),
      ).toBe(100);
  });

  it('is stable for the same seed and changes across task seeds', () => {
    const first = generateSectDeliveryRequirement({
      kind: 'pill',
      realm: '元婴',
      seed: 'member:task-a:2026-07-23:1',
    });
    expect(
      generateSectDeliveryRequirement({
        kind: 'pill',
        realm: '元婴',
        seed: 'member:task-a:2026-07-23:1',
      }),
    ).toEqual(first);
    expect(
      generateSectDeliveryRequirement({
        kind: 'pill',
        realm: '元婴',
        seed: 'member:task-b:2026-07-23:1',
      }),
    ).not.toEqual(first);
  });

  it('always generates the core delivery constraints', () => {
    for (const realm of REALM_VALUES) {
      for (let index = 0; index < 500; index += 1) {
        const pill = generateSectDeliveryRequirement({
          kind: 'pill',
          realm,
          seed: `${realm}:pill:${index}`,
        });
        const equipment = generateSectDeliveryRequirement({
          kind: 'equipment',
          realm,
          seed: `${realm}:equipment:${index}`,
        });
        const material = generateSectDeliveryRequirement({
          kind: 'material',
          realm,
          seed: `${realm}:material:${index}`,
        });
        expect(pill.kind).toBe('pill');
        if (pill.kind === 'pill') {
          expect(pill.family).toBeDefined();
          expect(pill.trait).toBeDefined();
          expect(pill.appearance).toBeDefined();
        }
        expect(equipment.kind).toBe('equipment');
        if (equipment.kind === 'equipment') {
          expect(equipment.slot).toBeDefined();
          expect(equipment.mustBeUnequipped).toBe(true);
        }
        expect(material.kind).toBe('material');
        if (material.kind === 'material')
          expect(material.materialType).toBeDefined();
      }
    }
  });

  it('uses the natural pill appearance distribution for requirements', () => {
    const samples = 20_000;
    const counts = { low: 0, middle: 0, high: 0, perfect: 0 };
    for (let index = 0; index < samples; index += 1) {
      const requirement = generateSectDeliveryRequirement({
        kind: 'pill',
        realm: '金丹',
        seed: `appearance:${index}`,
      });
      if (requirement.kind !== 'pill' || !requirement.appearance)
        throw new Error('丹药委托缺少品相要求');
      counts[requirement.appearance.grade] += 1;
      expect(requirement.appearance.mode).toBe(
        requirement.appearance.grade === 'perfect' ? 'exact' : 'at_least',
      );
    }
    expect(counts.low / samples).toBeGreaterThan(0.28);
    expect(counts.low / samples).toBeLessThan(0.32);
    expect(counts.middle / samples).toBeGreaterThan(0.43);
    expect(counts.middle / samples).toBeLessThan(0.47);
    expect(counts.high / samples).toBeGreaterThan(0.18);
    expect(counts.high / samples).toBeLessThan(0.22);
    expect(counts.perfect / samples).toBeGreaterThan(0.04);
    expect(counts.perfect / samples).toBeLessThan(0.06);
  });

  it('keeps elemental constraints optional', () => {
    const samples = 10_000;
    let elementCount = 0;
    for (let index = 0; index < samples; index += 1) {
      const material = generateSectDeliveryRequirement({
        kind: 'material',
        realm: '元婴',
        seed: `material-extra:${index}`,
      });
      if (material.kind === 'material' && material.element) elementCount += 1;
    }
    expect(elementCount / samples).toBeGreaterThan(0.33);
    expect(elementCount / samples).toBeLessThan(0.37);
  });

  it('never generates below 玄品 from 金丹 or above 仙品', () => {
    for (const realm of REALM_VALUES)
      for (let index = 0; index < 2_000; index += 1) {
        const quality = pickSectTaskMinimumQuality(
          realm,
          new SectTaskRandomSource(`${realm}:${index}`),
        );
        expect(QUALITY_ORDER[quality]).toBeLessThanOrEqual(
          QUALITY_ORDER['仙品'],
        );
        if (
          QUALITY_ORDER[
            realm === '炼气' ? '凡品' : realm === '筑基' ? '灵品' : '玄品'
          ] >= QUALITY_ORDER['玄品']
        )
          expect(QUALITY_ORDER[quality]).toBeGreaterThanOrEqual(
            QUALITY_ORDER['玄品'],
          );
      }
  });

  it('keeps high-realm 仙品 requirements uncommon', () => {
    const samples = 10_000;
    const immortalCount = Array.from({ length: samples }, (_, index) =>
      pickSectTaskMinimumQuality(
        '渡劫',
        new SectTaskRandomSource(`渡劫:${index}`),
      ),
    ).filter((quality) => quality === '仙品').length;
    expect(immortalCount / samples).toBeGreaterThan(0.055);
    expect(immortalCount / samples).toBeLessThan(0.085);
  });

  it('derives difficulty from the final requirement', () => {
    expect(
      calculateSectDeliveryDifficulty({
        kind: 'pill',
        quantity: 1,
        minQuality: '凡品',
        family: 'healing',
        trait: 'restore_hp',
        appearance: { mode: 'at_least', grade: 'low' },
      }),
    ).toBe('easy');
    expect(
      calculateSectDeliveryDifficulty({
        kind: 'pill',
        quantity: 1,
        minQuality: '天品',
        family: 'longevity',
        trait: 'increase_lifespan',
        appearance: { mode: 'exact', grade: 'perfect' },
      }),
    ).toBe('elite');
  });

  it.each([
    {
      requirement: {
        kind: 'pill' as const,
        quantity: 1 as const,
        minQuality: '玄品' as const,
        family: 'longevity' as const,
        trait: 'increase_lifespan' as const,
        appearance: { mode: 'at_least' as const, grade: 'middle' as const },
      },
      text: '1颗玄品以上、具有增加寿元功效的延寿丹，品相不可低于中品',
      rawTerms: ['longevity', 'increase_lifespan', 'middle'],
      emphasis: ['quantity', 'quality', 'effect', 'effect', 'appearance'],
    },
    {
      requirement: {
        kind: 'equipment' as const,
        quantity: 1 as const,
        minEquipmentLevel: 30,
        slot: 'weapon' as const,
        mustBeUnequipped: true as const,
      },
      text: '1件30级及以上法兵，必须处于未装备状态',
      rawTerms: ['weapon'],
      emphasis: ['quantity', 'effect', 'effect', 'warning'],
    },
    {
      requirement: {
        kind: 'material' as const,
        quantity: 3,
        minQuality: '真品' as const,
        materialType: 'ore' as const,
        element: '火' as const,
      },
      text: '3份真品以上的矿石类火属性材料',
      rawTerms: ['ore'],
      emphasis: ['quantity', 'quality', 'effect', 'effect'],
    },
  ])(
    'formats $requirement.kind requirements as player-facing Chinese',
    ({ requirement, text, rawTerms, emphasis }) => {
      expect(describeSectDeliveryRequirement(requirement)).toBe(text);
      const segments = formatSectDeliveryRequirement(requirement);
      expect(
        segments
          .filter((segment) => segment.emphasis)
          .map((segment) => segment.emphasis),
      ).toEqual(emphasis);
      for (const rawTerm of rawTerms) expect(text).not.toContain(rawTerm);
      expect(text).not.toContain('_');
    },
  );
});

it('generates craftable equipment tiers without quality or rare affix requirements', () => {
  const slots = new Set<string>();
  for (const realm of REALM_VALUES)
    for (const realmStage of REALM_STAGE_VALUES)
      for (let i = 0; i < 20; i++) {
        const req = generateSectDeliveryRequirement({
          kind: 'equipment',
          realm,
          realmStage,
          seed: String(i),
        });
        if (req.kind !== 'equipment') throw new Error('wrong kind');
        expect(
          SectEquipmentDeliveryRequirementSchema.safeParse(req).success,
        ).toBe(true);
        expect(
          BLUEPRINTS.some(
            (b) => b.level === req.minEquipmentLevel && b.slot === req.slot,
          ),
        ).toBe(true);
        expect(QINGXI_EQUIPMENT_LEVELS).toContain(req.minEquipmentLevel);
        expect(req).not.toHaveProperty('minQuality');
        expect(req).not.toHaveProperty('minPerfectAffixCount');
        slots.add(req.slot);
      }
  expect(slots.size).toBe(6);
  expect(
    generateSectDeliveryRequirement({
      kind: 'equipment',
      realm: '炼气',
      realmStage: '初期',
      seed: 'a',
    }),
  ).toMatchObject({ minEquipmentLevel: 10 });
  expect(
    generateSectDeliveryRequirement({
      kind: 'equipment',
      realm: '渡劫',
      realmStage: '圆满',
      seed: 'a',
    }),
  ).toMatchObject({ minEquipmentLevel: 10 });
});
it.each([
  [40, 'easy'],
  [50, 'normal'],
  [80, 'normal'],
  [90, 'hard'],
  [120, 'hard'],
  [130, 'elite'],
] as const)(
  'classifies equipment level %s independently of quality',
  (level, expected) => {
    expect(
      calculateSectDeliveryDifficulty({
        kind: 'equipment',
        quantity: 1,
        minEquipmentLevel: level,
        slot: 'head',
        mustBeUnequipped: true,
      }),
    ).toBe(expected);
  },
);
