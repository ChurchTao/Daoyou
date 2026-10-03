import {
  ALCHEMY_INPUT_CONSTRAINTS,
  ALCHEMY_MAX_DOSE,
} from '@daoyou/shared/config/alchemyInput';
import { JournalRequestSchema } from '@daoyou/shared/contracts/playerJournal';
import { PILL_FAMILY_VALUES } from '@daoyou/shared/types/consumable';
import { z } from 'zod';

export const DiscoveryConfirmSchema = z.object({
  token: z.string().uuid(),
  accept: z.boolean(),
});
export const FormulaIdParamSchema = z.object({ formulaId: z.string().uuid() });
export const FormulaAnalyzeSchema = z.object({
  materialIds: z.array(z.string()).min(1).max(6),
  materialVersions: z.record(z.string(), z.string().max(10000)),
  materialQuantities: z
    .record(
      z.string(),
      z
        .number()
        .int()
        .min(ALCHEMY_INPUT_CONSTRAINTS.minQuantityPerMaterial)
        .max(ALCHEMY_MAX_DOSE),
    )
    .optional(),
});
export const FormulaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5).default(5),
  search: z.string().trim().max(40).optional(),
  family: z.enum(PILL_FAMILY_VALUES).optional(),
});

export const CraftSchema = z
  .object({
    craftType: z.literal('alchemy'),
    alchemyMode: z.enum(['improvised', 'formula']).default('improvised'),
    materialIds: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, '材料不能重复'),
    materialVersions: z.record(z.string(), z.string().max(10000)),
    materialQuantities: z
      .record(z.string(), z.number().int().min(1).max(ALCHEMY_MAX_DOSE))
      .optional(),
    userPrompt: z.string().trim().max(300).optional(),
    formulaId: z.uuid().optional(),
    analysisId: z.uuid().optional(),
  })
  .strict();
export const CraftCommandSchema = CraftSchema.extend(
  JournalRequestSchema.shape,
);
