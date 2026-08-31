import { SPIRIT_FIELD_CULTIVATION_METHODS } from '@shared/engine/spirit-field';
import { z } from 'zod';

export const SpiritFieldPlotIndexSchema = z.number().int().min(0).max(5);
export const SpiritFieldSowRequestSchema = z.object({ plotIndex: SpiritFieldPlotIndexSchema, seedMaterialId: z.string().uuid() });
export const SpiritFieldCultivateRequestSchema = z.object({
  plotIndex: SpiritFieldPlotIndexSchema,
  method: z.enum(SPIRIT_FIELD_CULTIVATION_METHODS),
  resourceId: z.string().uuid().optional(),
  requestId: z.string().trim().min(8).max(128),
});
export const SpiritFieldHarvestRequestSchema = z.object({ plotIndex: SpiritFieldPlotIndexSchema, requestId: z.string().trim().min(8).max(128) });

export type SpiritFieldSowRequest = z.infer<typeof SpiritFieldSowRequestSchema>;
export type SpiritFieldCultivateRequest = z.infer<typeof SpiritFieldCultivateRequestSchema>;
export type SpiritFieldHarvestRequest = z.infer<typeof SpiritFieldHarvestRequestSchema>;
