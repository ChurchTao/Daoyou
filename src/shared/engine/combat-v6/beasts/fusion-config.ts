import { z } from 'zod';
import data from './data/fusion.json';
const weights = z
  .array(
    z.strictObject({
      value: z.number().int().positive(),
      weight: z.number().int().positive(),
    }),
  )
  .min(1)
  .refine(
    (rows) =>
      rows.reduce((sum, row) => sum + row.weight, 0) === 100 &&
      new Set(rows.map((row) => row.value)).size === rows.length,
    '融合档位必须唯一且权重合计100',
  );
const cap = z.number().int().positive();
export const BeastFusionConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: cap,
  minimumLevel: z.number().int().min(1).max(180),
  babyChance: z.number().min(0).max(1),
  pseudoBabyChance: z.number().min(0).max(1),
  skillChance: z.number().min(0).max(1),
  aptitudeCaps: z.strictObject({
    attack: cap,
    defense: cap,
    health: cap,
    mana: cap,
    speed: cap,
  }),
  growthMilliCap: z.number().int().min(100).max(3000),
  aptitudeWeights: weights,
  growthWeights: weights,
});
export const BEAST_FUSION = BeastFusionConfigSchema.parse(data);
export const BEAST_FUSION_VERSION = 'summoned_beast_fusion_v1' as const;
