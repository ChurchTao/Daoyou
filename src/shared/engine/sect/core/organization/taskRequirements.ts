import { DAO_EQUIPMENT_SLOTS } from '@shared/engine/combat-v6/equipment/types';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import type { DailyTaskDifficulty } from '@shared/engine/cultivation/exp-gain-strategies/types';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { getMaterialTypeLabel } from '@shared/lib/gameConceptDisplay';
import { getPillAppearanceLabel } from '@shared/lib/pillAppearance';
import { QINGXI_EQUIPMENT_LEVELS } from '@shared/rewards/wild';
import type { RealmStage } from '@shared/types/constants';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
  REALM_ORDER,
  type ElementType,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import {
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
  type PillAppearanceGrade,
  type PillFamily,
} from '@shared/types/consumable';
import { z } from 'zod';
import type {
  SectTaskDialogueEmphasis,
  SectTaskDialogueSegment,
} from './contracts';

export const SECT_PILL_TRAIT_KEYS = [
  'restore_hp',
  'restore_mp',
  'detox',
  'gain_cultivation',
  'gain_insight',
  'breakthrough_support',
  'tempering',
  'marrow_wash',
  'increase_lifespan',
] as const;

export type SectPillTraitKey = (typeof SECT_PILL_TRAIT_KEYS)[number];
export type SectSubmissionItemKind = 'pill' | 'equipment' | 'material';

const SECT_PILL_FAMILY_LABELS: Record<PillFamily, string> = {
  healing: '疗伤丹',
  mana: '回元丹',
  detox: '解毒丹',
  cultivation: '修为丹',
  insight: '悟性丹',
  breakthrough: '破境辅助丹',
  tempering: '淬体丹',
  marrow_wash: '洗髓丹',
  longevity: '延寿丹',
  hybrid: '复合丹',
};

const SECT_PILL_TRAIT_LABELS: Record<SectPillTraitKey, string> = {
  restore_hp: '恢复气血',
  restore_mp: '恢复法力',
  detox: '解毒祛浊',
  gain_cultivation: '增加修为',
  gain_insight: '增加感悟',
  breakthrough_support: '辅助突破',
  tempering: '淬炼体魄',
  marrow_wash: '洗髓伐脉',
  increase_lifespan: '增加寿元',
};

export function getSectPillFamilyLabel(family: PillFamily): string {
  return SECT_PILL_FAMILY_LABELS[family];
}

export function getSectPillTraitLabel(trait: SectPillTraitKey): string {
  return SECT_PILL_TRAIT_LABELS[trait];
}

export const STANDARD_SECT_TASK_REQUIREMENT_CURVE = {
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
    conditionScore: {
      pillCore: 3,
      exactAppearance: 3,
      highAppearance: 2,
      materialCore: 1,
      element: 1,
    },
    maximumScore: {
      easy: 3,
      normal: 6,
      hard: 10,
    },
  },
} as const satisfies {
  quantity: {
    pill: 1;
    equipment: 1;
    material: {
      min: number;
      max: number;
      highQuality: number;
      highQualityThreshold: Quality;
    };
  };
  pillAppearanceWeights: readonly {
    grade: PillAppearanceGrade;
    weight: number;
  }[];
  optionalConditionChance: {
    materialElement: number;
  };
  difficulty: {
    qualityScoreMultiplier: number;
    conditionScore: {
      pillCore: number;
      exactAppearance: number;
      highAppearance: number;
      materialCore: number;
      element: number;
    };
    maximumScore: Record<Exclude<DailyTaskDifficulty, 'elite'>, number>;
  };
};

export function assertStandardSectTaskRequirementCurve(): void {
  const curve = STANDARD_SECT_TASK_REQUIREMENT_CURVE;
  const materialQuantity = curve.quantity.material;
  if (
    !Number.isInteger(materialQuantity.min) ||
    !Number.isInteger(materialQuantity.max) ||
    !Number.isInteger(materialQuantity.highQuality) ||
    materialQuantity.min <= 0 ||
    materialQuantity.min > materialQuantity.max ||
    materialQuantity.highQuality < materialQuantity.min ||
    materialQuantity.highQuality > materialQuantity.max
  )
    throw new Error('宗门任务交付数量配置无效');

  const appearanceWeights = curve.pillAppearanceWeights;
  if (
    new Set(appearanceWeights.map((entry) => entry.grade)).size !==
      appearanceWeights.length ||
    appearanceWeights.some(
      (entry) => !Number.isInteger(entry.weight) || entry.weight <= 0,
    ) ||
    appearanceWeights.reduce((sum, entry) => sum + entry.weight, 0) !== 100
  )
    throw new Error('宗门任务丹药品相权重配置无效');

  if (
    Object.values(curve.optionalConditionChance).some(
      (chance) => !Number.isFinite(chance) || chance < 0 || chance > 1,
    )
  )
    throw new Error('宗门任务可选条件概率配置无效');

  const scoreValues = [
    curve.difficulty.qualityScoreMultiplier,
    ...Object.values(curve.difficulty.conditionScore),
  ];
  const maximumScore = curve.difficulty.maximumScore;
  if (
    scoreValues.some((score) => !Number.isInteger(score) || score < 0) ||
    !(
      maximumScore.easy < maximumScore.normal &&
      maximumScore.normal < maximumScore.hard
    )
  )
    throw new Error('宗门任务难度评分配置无效');
}

const QualitySchema = z.enum(QUALITY_VALUES);
const AppearanceSchema = z.enum(PILL_APPEARANCE_GRADE_VALUES);

export const SectPillDeliveryRequirementSchema = z
  .object({
    kind: z.literal('pill'),
    quantity: z.literal(STANDARD_SECT_TASK_REQUIREMENT_CURVE.quantity.pill),
    minQuality: QualitySchema,
    family: z.enum(PILL_FAMILY_VALUES),
    trait: z.enum(SECT_PILL_TRAIT_KEYS),
    appearance: z.object({
      mode: z.enum(['at_least', 'exact']),
      grade: AppearanceSchema,
    }),
  })
  .strict();

export const SectEquipmentDeliveryRequirementSchema = z
  .object({
    kind: z.literal('equipment'),
    quantity: z.literal(
      STANDARD_SECT_TASK_REQUIREMENT_CURVE.quantity.equipment,
    ),
    minEquipmentLevel: z.number().int().min(10).max(180).multipleOf(10),
    slot: z.enum(DAO_EQUIPMENT_SLOTS),
    mustBeUnequipped: z.literal(true),
  })
  .strict();

export const SectMaterialDeliveryRequirementSchema = z
  .object({
    kind: z.literal('material'),
    quantity: z
      .number()
      .int()
      .min(STANDARD_SECT_TASK_REQUIREMENT_CURVE.quantity.material.min)
      .max(STANDARD_SECT_TASK_REQUIREMENT_CURVE.quantity.material.max),
    minQuality: QualitySchema,
    materialType: z.enum(MATERIAL_TYPE_VALUES),
    element: z
      .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
      .optional(),
  })
  .strict();

export const SectDeliveryRequirementSchema = z.discriminatedUnion('kind', [
  SectPillDeliveryRequirementSchema,
  SectEquipmentDeliveryRequirementSchema,
  SectMaterialDeliveryRequirementSchema,
]);

export type SectPillDeliveryRequirement = z.infer<
  typeof SectPillDeliveryRequirementSchema
>;
export type SectEquipmentDeliveryRequirement = z.infer<
  typeof SectEquipmentDeliveryRequirementSchema
>;
export type SectMaterialDeliveryRequirement = z.infer<
  typeof SectMaterialDeliveryRequirementSchema
>;
export type SectDeliveryRequirement = z.infer<
  typeof SectDeliveryRequirementSchema
>;

export interface SectRealmQualityRule {
  readonly weights: Readonly<Partial<Record<Quality, number>>>;
}

export const SECT_REALM_QUALITY_RULES: Readonly<
  Record<RealmType, SectRealmQualityRule>
> = {
  炼气: { weights: { 凡品: 70, 灵品: 30 } },
  筑基: { weights: { 灵品: 70, 玄品: 30 } },
  金丹: { weights: { 玄品: 75, 真品: 25 } },
  元婴: { weights: { 玄品: 55, 真品: 30, 地品: 15 } },
  化神: { weights: { 玄品: 45, 真品: 30, 地品: 18, 天品: 7 } },
  炼虚: { weights: { 玄品: 40, 真品: 28, 地品: 18, 天品: 11, 仙品: 3 } },
  合体: { weights: { 玄品: 35, 真品: 28, 地品: 20, 天品: 13, 仙品: 4 } },
  大乘: { weights: { 玄品: 30, 真品: 27, 地品: 22, 天品: 16, 仙品: 5 } },
  渡劫: { weights: { 玄品: 25, 真品: 25, 地品: 23, 天品: 20, 仙品: 7 } },
};

export function assertSectRealmQualityRules(
  rules: Readonly<
    Record<RealmType, SectRealmQualityRule>
  > = SECT_REALM_QUALITY_RULES,
): void {
  for (const [realm, rule] of Object.entries(rules) as Array<
    [RealmType, SectRealmQualityRule]
  >) {
    const entries = Object.entries(rule.weights) as Array<[Quality, number]>;
    if (entries.length === 0) throw new Error(`宗门任务品质配置为空：${realm}`);
    if (
      entries.some(
        ([quality, weight]) =>
          quality === '神品' ||
          !Number.isFinite(weight) ||
          !Number.isInteger(weight) ||
          weight <= 0,
      )
    )
      throw new Error(`宗门任务品质配置无效：${realm}`);
    if (entries.reduce((sum, [, weight]) => sum + weight, 0) !== 100)
      throw new Error(`宗门任务品质权重总和必须为 100：${realm}`);
    if (
      REALM_ORDER[realm] >= REALM_ORDER['金丹'] &&
      entries.some(
        ([quality]) => QUALITY_ORDER[quality] < QUALITY_ORDER['玄品'],
      )
    )
      throw new Error(`金丹及以上不得要求玄品以下物品：${realm}`);
    if (
      entries.some(
        ([quality]) => QUALITY_ORDER[quality] > QUALITY_ORDER['仙品'],
      )
    )
      throw new Error(`宗门任务不得要求仙品以上物品：${realm}`);
  }
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SectTaskRandomSource {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('宗门任务随机池不能为空');
    return items[
      Math.min(items.length - 1, Math.floor(this.next() * items.length))
    ]!;
  }
}

export function pickSectTaskMinimumQuality(
  realm: RealmType,
  random: SectTaskRandomSource,
): Quality {
  const entries = Object.entries(
    SECT_REALM_QUALITY_RULES[realm].weights,
  ) as Array<[Quality, number]>;
  const roll = random.next() * 100;
  let cumulative = 0;
  for (const [quality, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) return quality;
  }
  return entries[entries.length - 1]![0];
}

const PILL_TRAIT_TEMPLATES: readonly {
  family: PillFamily;
  trait: SectPillTraitKey;
}[] = [
  { family: 'healing', trait: 'restore_hp' },
  { family: 'mana', trait: 'restore_mp' },
  { family: 'detox', trait: 'detox' },
  { family: 'cultivation', trait: 'gain_cultivation' },
  { family: 'insight', trait: 'gain_insight' },
  { family: 'breakthrough', trait: 'breakthrough_support' },
  { family: 'tempering', trait: 'tempering' },
  { family: 'marrow_wash', trait: 'marrow_wash' },
  { family: 'longevity', trait: 'increase_lifespan' },
] as const;

const MATERIAL_TYPES: readonly MaterialType[] = [
  'herb',
  'ore',
  'monster',
  'aux',
];
const ELEMENTS: readonly ElementType[] = [
  '金',
  '木',
  '水',
  '火',
  '土',
  '风',
  '雷',
  '冰',
];

function pickPillAppearanceRequirement(
  random: SectTaskRandomSource,
): NonNullable<SectPillDeliveryRequirement['appearance']> {
  const roll = random.next() * 100;
  let cumulative = 0;
  const weights = STANDARD_SECT_TASK_REQUIREMENT_CURVE.pillAppearanceWeights;
  for (const entry of weights) {
    cumulative += entry.weight;
    if (roll < cumulative)
      return {
        mode: entry.grade === 'perfect' ? 'exact' : 'at_least',
        grade: entry.grade,
      };
  }
  return { mode: 'exact', grade: 'perfect' };
}

export function generateSectDeliveryRequirement(input: {
  kind: SectSubmissionItemKind;
  realm: RealmType;
  realmStage?: RealmStage;
  seed: string;
}): SectDeliveryRequirement {
  const curve = STANDARD_SECT_TASK_REQUIREMENT_CURVE;
  const random = new SectTaskRandomSource(input.seed);
  if (input.kind === 'equipment') {
    return {
      kind: 'equipment',
      quantity: 1,
      minEquipmentLevel: Math.max(
        ...QINGXI_EQUIPMENT_LEVELS.filter(
          (level) =>
            level <=
            Math.max(
              10,
              combatCharacterLevel(input.realm, input.realmStage ?? '初期'),
            ),
        ),
      ),
      slot: random.pick(DAO_EQUIPMENT_SLOTS),
      mustBeUnequipped: true,
    };
  }

  const minQuality = pickSectTaskMinimumQuality(input.realm, random);

  if (input.kind === 'pill') {
    const template = random.pick(PILL_TRAIT_TEMPLATES);
    return {
      kind: 'pill',
      quantity: curve.quantity.pill,
      minQuality,
      family: template.family,
      trait: template.trait,
      appearance: pickPillAppearanceRequirement(random),
    };
  }

  const materialQuantity = curve.quantity.material;
  const highQuality =
    QUALITY_ORDER[minQuality] >=
    QUALITY_ORDER[materialQuantity.highQualityThreshold];
  const quantity = highQuality
    ? materialQuantity.highQuality
    : materialQuantity.min +
      Math.floor(
        random.next() * (materialQuantity.max - materialQuantity.min + 1),
      );
  const materialType = random.pick(MATERIAL_TYPES);
  const includeElement =
    random.next() < curve.optionalConditionChance.materialElement;
  return {
    kind: 'material',
    quantity,
    minQuality,
    materialType,
    ...(includeElement ? { element: random.pick(ELEMENTS) } : {}),
  };
}

export function calculateSectDeliveryDifficulty(
  requirement: SectDeliveryRequirement,
): DailyTaskDifficulty {
  if (requirement.kind === 'equipment') {
    const level = requirement.minEquipmentLevel;
    return level <= 40
      ? 'easy'
      : level <= 80
        ? 'normal'
        : level <= 120
          ? 'hard'
          : 'elite';
  }
  const curve = STANDARD_SECT_TASK_REQUIREMENT_CURVE.difficulty;
  let score =
    QUALITY_ORDER[requirement.minQuality] * curve.qualityScoreMultiplier;
  if (requirement.kind === 'pill') {
    score += curve.conditionScore.pillCore;
    if (requirement.appearance.mode === 'exact')
      score += curve.conditionScore.exactAppearance;
    else if (['high', 'perfect'].includes(requirement.appearance.grade))
      score += curve.conditionScore.highAppearance;
  } else {
    score += curve.conditionScore.materialCore;
    if (requirement.element) score += curve.conditionScore.element;
  }
  if (score <= curve.maximumScore.easy) return 'easy';
  if (score <= curve.maximumScore.normal) return 'normal';
  if (score <= curve.maximumScore.hard) return 'hard';
  return 'elite';
}

function emphasized(
  text: string,
  emphasis: SectTaskDialogueEmphasis,
): SectTaskDialogueSegment {
  return { text, emphasis };
}

export function formatSectDeliveryRequirement(
  requirement: SectDeliveryRequirement,
): readonly SectTaskDialogueSegment[] {
  if (requirement.kind === 'equipment')
    return [
      emphasized('1件', 'quantity'),
      emphasized(`${requirement.minEquipmentLevel}级及以上`, 'effect'),
      emphasized(EQUIPMENT_SLOT_NAMES[requirement.slot], 'effect'),
      { text: '，必须处于' },
      emphasized('未装备', 'warning'),
      { text: '状态' },
    ];
  const segments: SectTaskDialogueSegment[] = [
    emphasized(
      `${requirement.quantity}${requirement.kind === 'pill' ? '颗' : '份'}`,
      'quantity',
    ),
    emphasized(`${requirement.minQuality}以上`, 'quality'),
  ];

  if (requirement.kind === 'pill') {
    segments.push(
      { text: '、具有' },
      emphasized(getSectPillTraitLabel(requirement.trait), 'effect'),
      { text: '功效的' },
      emphasized(getSectPillFamilyLabel(requirement.family), 'effect'),
      {
        text:
          requirement.appearance.mode === 'exact'
            ? '，品相须为'
            : '，品相不可低于',
      },
      emphasized(
        getPillAppearanceLabel(requirement.appearance.grade),
        'appearance',
      ),
    );
    return segments;
  }

  segments.push(
    { text: '的' },
    emphasized(getMaterialTypeLabel(requirement.materialType), 'effect'),
    { text: '类' },
  );
  if (requirement.element) {
    segments.push(emphasized(`${requirement.element}属性`, 'effect'));
  }
  segments.push({ text: '材料' });
  return segments;
}

export function describeSectDeliveryRequirement(
  requirement: SectDeliveryRequirement,
): string {
  return formatSectDeliveryRequirement(requirement)
    .map((segment) => segment.text)
    .join('');
}
