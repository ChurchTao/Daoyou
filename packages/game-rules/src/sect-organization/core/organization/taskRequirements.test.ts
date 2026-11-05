import { BLUEPRINTS } from '@daoyou/game-content/items/equipment';
import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { describe, expect, it } from 'vitest';
import {
  SECT_REALM_QUALITY_RULES,
  STANDARD_SECT_TASK_REQUIREMENT_CURVE,
  SectEquipmentDeliveryRequirementSchema,
  SectTaskRandomSource,
  assertSectRealmQualityRules,
  assertStandardSectTaskRequirementCurve,
  calculateSectDeliveryDifficulty,
  formatSectDeliveryRequirement,
  generateSectDeliveryRequirement,
  pickSectTaskMinimumQuality,
} from './taskRequirements.js';

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
      const pill = generateSectDeliveryRequirement({
        kind: 'pill',
        realm,
        seed: `${realm}:pill:0`,
      });
      const material = generateSectDeliveryRequirement({
        kind: 'material',
        realm,
        seed: `${realm}:material:0`,
      });
      expect(pill).toMatchObject({
        kind: 'pill',
        family: expect.any(String),
        trait: expect.any(String),
        appearance: { grade: expect.any(String), mode: expect.any(String) },
      });
      expect(material).toMatchObject({
        kind: 'material',
        materialType: expect.any(String),
      });
    }
  });

  it('only requires exact appearance for a perfect pill', () => {
    for (const [seed, grade] of [
      ['appearance:4', 'low'],
      ['appearance:2', 'middle'],
      ['appearance:0', 'high'],
      ['appearance:3', 'perfect'],
    ] as const) {
      const requirement = generateSectDeliveryRequirement({
        kind: 'pill',
        realm: '金丹',
        seed,
      });
      expect(requirement).toMatchObject({
        appearance: { grade, mode: grade === 'perfect' ? 'exact' : 'at_least' },
      });
    }
  });

  it('keeps elemental constraints optional', () => {
    const material = { kind: 'material', realm: '元婴' } as const;
    expect(
      generateSectDeliveryRequirement({ ...material, seed: 'material-extra:0' }),
    ).not.toHaveProperty('element');
    expect(
      generateSectDeliveryRequirement({ ...material, seed: 'material-extra:1' }),
    ).toHaveProperty('element', expect.any(String));
  });

  it('samples only legal qualities and reserves the top 7% at 渡劫 for 仙品', () => {
    const random = new SectTaskRandomSource('quality-boundary');
    random.next = () => 0;
    for (const realm of REALM_VALUES.slice(2)) {
      expect(QUALITY_ORDER[pickSectTaskMinimumQuality(realm, random)])
        .toBeGreaterThanOrEqual(QUALITY_ORDER.玄品);
    }
    random.next = () => 0.9999;
    for (const realm of REALM_VALUES) {
      expect(QUALITY_ORDER[pickSectTaskMinimumQuality(realm, random)])
        .toBeLessThanOrEqual(QUALITY_ORDER.仙品);
    }
    random.next = () => 0.9299;
    expect(pickSectTaskMinimumQuality('渡劫', random)).toBe('天品');
    random.next = () => 0.9301;
    expect(pickSectTaskMinimumQuality('渡劫', random)).toBe('仙品');
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
      rawTerms: ['ore'],
      emphasis: ['quantity', 'quality', 'effect', 'effect'],
    },
  ])(
    'formats $requirement.kind requirements as player-facing Chinese',
    ({ requirement, rawTerms, emphasis }) => {
      const segments = formatSectDeliveryRequirement(requirement);
      const text = segments.map((segment) => segment.text).join('');
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
  for (const [realm, realmStage] of [
    ['炼气', '初期'],
    ['渡劫', '圆满'],
  ] as const) {
    for (let index = 0; index < 20; index++) {
      const requirement = generateSectDeliveryRequirement({
        kind: 'equipment',
        realm,
        realmStage,
        seed: String(index),
      });
      if (requirement.kind !== 'equipment') throw new Error('wrong kind');
      expect(SectEquipmentDeliveryRequirementSchema.safeParse(requirement).success)
        .toBe(true);
      expect(
        BLUEPRINTS.some(
          (blueprint) =>
            blueprint.level === requirement.minEquipmentLevel &&
            blueprint.slot === requirement.slot,
        ),
      ).toBe(true);
      expect(requirement.minEquipmentLevel).toBe(10);
      expect(requirement.mustBeUnequipped).toBe(true);
      expect(requirement).not.toHaveProperty('minQuality');
      expect(requirement).not.toHaveProperty('minPerfectAffixCount');
      slots.add(requirement.slot);
    }
  }
  expect(slots.size).toBe(6);
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
