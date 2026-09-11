import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/progression.json';

const integer = z.number().int().nonnegative().max(100_000_000);
const coefficient = z.number().nonnegative().max(100).multipleOf(0.000001);
export const SectProgressionPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  method: z.strictObject({
    maxLevel: z.number().int().min(1).max(180),
    characterLevelAllowance: z.number().int().min(0).max(180),
    expBase: integer,
    expGrowth: coefficient.min(1),
    expRounding: integer.positive(),
    stonesPerExp: coefficient,
    stonesRounding: integer.positive(),
    insight: integer,
  }),
  meridian: z.strictObject({
    characterLevels: z.array(z.number().int().min(0).max(180)).length(7),
    expBase: integer,
    expGrowth: coefficient.min(1),
    growthExponentCap: z.number().int().min(0).max(6),
    stonesPerExp: coefficient,
    insight: integer,
  }),
});
export type SectProgressionPack = z.infer<typeof SectProgressionPackShape>;

/** 指数、向上取整和运算次序属于现行经济算法。 */
export function configuredMethodCost(pack: SectProgressionPack, targetLevel: number) {
  const rule = pack.method;
  const cultivationExp = Math.ceil((rule.expBase * rule.expGrowth ** (targetLevel - 1)) / rule.expRounding) * rule.expRounding;
  return {
    cultivationExp,
    spiritStones: Math.ceil((cultivationExp * rule.stonesPerExp) / rule.stonesRounding) * rule.stonesRounding,
    comprehensionInsight: rule.insight,
  };
}
export function configuredMeridianCost(pack: SectProgressionPack, layer: number) {
  const rule = pack.meridian;
  const cultivationExp = rule.expBase * rule.expGrowth ** Math.min(layer - 1, rule.growthExponentCap);
  return { cultivationExp, spiritStones: cultivationExp * rule.stonesPerExp, comprehensionInsight: rule.insight };
}
export function loadSectProgressionPack(data: unknown): SectProgressionPack {
  const result = SectProgressionPackShape.superRefine((pack, ctx) => {
    pack.meridian.characterLevels.forEach((level, index, levels) => {
      if (index > 0 && level <= levels[index - 1])
        ctx.addIssue({ code: 'custom', path: ['meridian', 'characterLevels', index], message: '解锁等级必须严格递增' });
    });
    for (const [section, count, cost] of [
      ['method', pack.method.maxLevel, configuredMethodCost],
      ['meridian', 7, configuredMeridianCost],
    ] as const) {
      for (let level = 1; level <= count; level++) {
        for (const [field, value] of Object.entries(cost(pack, level))) {
          if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000)
            ctx.addIssue({ code: 'custom', path: [section, level, field], message: '计算费用必须为 0～100000000000 的安全整数' });
        }
      }
    }
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('sect-progression/data/progression.json', data, result.error.issues));
  return result.data;
}
export const SECT_PROGRESSION = loadSectProgressionPack(raw);
export function methodLevelCap(characterLevel: number): number {
  return Math.min(SECT_PROGRESSION.method.maxLevel, characterLevel + SECT_PROGRESSION.method.characterLevelAllowance);
}
