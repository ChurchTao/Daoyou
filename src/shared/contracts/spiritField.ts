import { ELEMENT_VALUES } from '@shared/types/constants';
import { SPIRIT_FIELD_CARE_ACTIONS } from '@shared/engine/spirit-field';
import { z } from 'zod';

export const SpiritFieldPlotIndexSchema = z.number().int().min(0).max(5);

export const SpiritFieldSowRequestSchema = z.object({
  plotIndex: SpiritFieldPlotIndexSchema,
  seedMaterialId: z.string().uuid(),
});

export const SpiritFieldInterpretRequestSchema = z.object({
  plotIndex: SpiritFieldPlotIndexSchema,
  message: z.string().trim().min(1).max(240),
});

export const SpiritFieldCarePlanSchema = z.object({
  action: z.enum(SPIRIT_FIELD_CARE_ACTIONS),
  element: z.enum(ELEMENT_VALUES).optional(),
  intensity: z.enum(['light', 'moderate']),
  target: z.enum(['soil', 'root', 'leaf', 'whole']),
  summary: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(160),
  risk: z.string().trim().min(1).max(160),
  qiCost: z.number().int().min(0).max(20),
});

export const SpiritFieldCareRequestSchema = z.object({
  plotIndex: SpiritFieldPlotIndexSchema,
  plan: SpiritFieldCarePlanSchema,
  requestId: z.string().trim().min(8).max(128),
});

export const SpiritFieldHarvestRequestSchema = z.object({
  plotIndex: SpiritFieldPlotIndexSchema,
  mode: z.enum(['focused', 'broad']),
  requestId: z.string().trim().min(8).max(128),
});

export const SpiritFieldUpgradeRequestSchema = z.object({
  requestId: z.string().trim().min(8).max(128),
});

export type SpiritFieldSowRequest = z.infer<typeof SpiritFieldSowRequestSchema>;
export type SpiritFieldInterpretRequest = z.infer<typeof SpiritFieldInterpretRequestSchema>;
export type SpiritFieldCareRequest = z.infer<typeof SpiritFieldCareRequestSchema>;
export type SpiritFieldHarvestRequest = z.infer<typeof SpiritFieldHarvestRequestSchema>;
export type SpiritFieldUpgradeRequest = z.infer<typeof SpiritFieldUpgradeRequestSchema>;
