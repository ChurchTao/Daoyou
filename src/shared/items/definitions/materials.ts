import { z } from 'zod';
import { ELEMENT_VALUES, QUALITY_VALUES } from '../../types/constants';
export const FORGING_MATERIAL_TYPES = [
  'ore',
  'tcdb',
  'aux',
  'monster',
] as const;
export const MATERIAL_TYPE_NAMES = {
  ore: '矿石',
  tcdb: '天材地宝',
  aux: '辅助材料',
  monster: '妖兽材料',
};
export const MATERIAL_ITEM = {
  id: 'material.v1',
  name: '材料',
  kind: 'material' as const,
  stackLimit: 99,
};
/** Explicit immutable facts. Legacy arbitrary details are deliberately not executable rules. */
export const MaterialFactsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(FORGING_MATERIAL_TYPES),
    rank: z.enum(QUALITY_VALUES),
    element: z.enum(ELEMENT_VALUES).nullable().default(null),
    description: z.string().max(4000).default(''),
  })
  .strict();
export type MaterialFacts = z.infer<typeof MaterialFactsSchema>;
