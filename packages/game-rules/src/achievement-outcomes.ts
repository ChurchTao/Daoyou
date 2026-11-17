import { QUALITY_ORDER, QUALITY_VALUES } from '@daoyou/constants/qualities';
import {
  MAX_ALCHEMY_OUTPUT_LOTS,
  MAX_ALCHEMY_OUTPUT_QUANTITY,
} from '@daoyou/game-content/alchemy';
import { daoEquipmentTemplateOf } from '@daoyou/game-content/equipment/base';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import { PILL_APPEARANCE_GRADE_VALUES } from '@daoyou/game-domain/consumables';
import { z } from 'zod';
import { daoEquipmentBaseRange } from './equipment/ranges.js';
import { InventoryEquipmentSchema } from './inventory/equipment.js';

export type AchievementOutcomeMetrics = Record<string, number>;

/** Evaluate all predicates on ONE newly forged item before retaining maxima. */
export function forgingAchievementMetrics(
  equipment: z.infer<typeof InventoryEquipmentSchema>,
): AchievementOutcomeMetrics {
  const level = equipment.equipmentLevel;
  const essences = new Set(equipment.essenceIds).size;
  const hasArt = Boolean(equipment.artId);
  const hasBlue = essences > 0 || hasArt;
  const triple = essences === 2 && hasArt;
  const template = daoEquipmentTemplateOf(equipment.templateId);
  const flawless =
    equipment.baseQuality === 1 &&
    template !== undefined &&
    equipment.baseStats.length === template.baseStats.length &&
    template.baseStats.every((rule) => {
      const stat = equipment.baseStats.find(
        (entry) => entry.attr === rule.attr,
      );
      const range = daoEquipmentBaseRange(
        rule,
        level,
        equipment.baseQuality,
        equipment.weaponType,
      );
      return (
        stat !== undefined &&
        stat.value >= Math.ceil(range.min + (range.max - range.min) * 0.9) &&
        stat.value <= range.max
      );
    });
  return {
    'forging.blue_level': hasBlue ? level : 0,
    'forging.double_essence': Number(level >= 50 && essences === 2),
    'forging.essence_art': Number(level >= 90 && essences > 0 && hasArt),
    'forging.triple_blue': Number(level >= 90 && triple),
    'forging.high_triple_blue': Number(level >= 150 && triple),
    'forging.double_bonus_blue': Number(
      level >= 90 &&
        hasBlue &&
        (equipment.slot === 'weapon' || equipment.slot === 'armor') &&
        new Set(equipment.attributeBonuses.map((bonus) => bonus.attr)).size ===
          2,
    ),
    'forging.flawless_base': Number(level >= 90 && flawless),
  };
}

const AlchemyOutcomeSchema = z
  .object({
    totalQuantity: z.number().int().min(0).max(MAX_ALCHEMY_OUTPUT_QUANTITY),
    lots: z
      .array(
        z.object({
          quality: z.enum(QUALITY_VALUES),
          appearance: z.enum(PILL_APPEARANCE_GRADE_VALUES),
          quantity: z
            .number()
            .int()
            .positive()
            .max(MAX_ALCHEMY_OUTPUT_QUANTITY),
        }),
      )
      .max(MAX_ALCHEMY_OUTPUT_LOTS),
  })
  .refine(
    (batch) =>
      batch.totalQuantity ===
      batch.lots.reduce((sum, lot) => sum + lot.quantity, 0),
    '本炉丹药数量与批次不符',
  );

/** The complete, committed yield profile is required, not a showcase or bag stack. */
export function alchemyAchievementMetrics(
  batch: z.infer<typeof AlchemyOutcomeSchema>,
): AchievementOutcomeMetrics {
  const complete = AlchemyOutcomeSchema.parse(batch);
  const perfect = complete.lots.filter(
    (lot) =>
      lot.appearance === 'perfect' &&
      QUALITY_ORDER[lot.quality] >= QUALITY_ORDER['玄品'],
  );
  const quantity = perfect.reduce((sum, lot) => sum + lot.quantity, 0);
  return {
    'alchemy.perfect_batch': quantity,
    'alchemy.perfect_quality': Math.max(
      0,
      ...perfect.map((lot) => QUALITY_ORDER[lot.quality]),
    ),
    'alchemy.full_perfect': Number(
      complete.totalQuantity >= 18 && quantity === complete.totalQuantity,
    ),
    'alchemy.three_perfect_qualities': Number(
      new Set(perfect.map((lot) => lot.quality)).size >= 3,
    ),
  };
}

/** Missing/partial historical receipts prove nothing; never fall back to the first pill. */
export function productionAchievementMetrics(
  activity: string,
  result: unknown,
): AchievementOutcomeMetrics | null {
  if (activity === 'forging') {
    const parsed = z
      .object({ equipment: InventoryEquipmentSchema })
      .safeParse(result);
    if (!parsed.success) return null;
    const equipment = parsed.data.equipment;
    const template = daoEquipmentTemplateOf(equipment.templateId);
    if (
      !template ||
      !template.baseStats.every((stat) =>
        stat.ranges.some((range) => range.level === equipment.equipmentLevel),
      )
    )
      return null;
    return forgingAchievementMetrics(equipment);
  }
  if (activity === 'alchemy_formula' || activity === 'alchemy_improvised') {
    const parsed = z
      .object({ yieldProfile: AlchemyOutcomeSchema })
      .safeParse(result);
    return parsed.success
      ? alchemyAchievementMetrics(parsed.data.yieldProfile)
      : null;
  }
  return null;
}

/** Parent identity and result belong to the same durable fusion receipt. */
export function fusionAchievementMetrics(
  parents: readonly [SummonedBeast, SummonedBeast],
  result: SummonedBeast,
): AchievementOutcomeMetrics {
  const skills = new Set(result.skills);
  const inherited = new Set(parents.flatMap((parent) => parent.skills));
  const aptitudeKeys = [
    'attack',
    'defense',
    'health',
    'mana',
    'speed',
  ] as const;
  return {
    'beasts.fusion_talented': Number(skills.size >= 8 && result.growth >= 1.3),
    'beasts.fusion_excellent': Number(
      skills.size >= 12 && result.growth >= 1.4,
    ),
    'beasts.fusion_inherited': Number(
      inherited.size >= 10 &&
        [...inherited].every((skill) => skills.has(skill)),
    ),
    'beasts.fusion_surpassed': Number(
      aptitudeKeys.every(
        (key) =>
          result.aptitudes[key] >
          Math.max(parents[0].aptitudes[key], parents[1].aptitudes[key]),
      ),
    ),
  };
}
