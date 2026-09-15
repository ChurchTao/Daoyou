import type { CharacterPanelV1 } from '@shared/engine/combat-v6/projection';
import { z } from 'zod';

export const AttributeAllocationSchema = z
  .object({
    attribute_model_version: z.literal(2),
    vitality: z.number().int().min(0).max(100000).default(0),
    strength: z.number().int().min(0).max(100000).default(0),
    spirit: z.number().int().min(0).max(100000).default(0),
    endurance: z.number().int().min(0).max(100000).default(0),
    speed: z.number().int().min(0).max(100000).default(0),
    willpower: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

export type AttributeAllocationRequest = z.infer<
  typeof AttributeAllocationSchema
>;
export interface AttributePreviewData {
  current: CharacterPanelV1;
  preview: CharacterPanelV1;
}
