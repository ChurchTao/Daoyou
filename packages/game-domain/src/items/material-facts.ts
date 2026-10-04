import { z } from 'zod';

import { ELEMENT_VALUES } from '@daoyou/constants/elements';

import { QUALITY_VALUES } from '@daoyou/constants/qualities';

export const FORGING_MATERIAL_TYPES = [
  'ore',
  'tcdb',
  'aux',
  'monster',
] as const;

export const MATERIAL_TYPE_NAMES = {
  herb: '草药',
  ore: '矿石',
  tcdb: '天材地宝',
  aux: '辅助材料',
  monster: '妖兽材料',
  gongfa_manual: '功法典籍',
  skill_manual: '神通秘术',
};

export const INVENTORY_MATERIAL_TYPES = [
  'herb',
  ...FORGING_MATERIAL_TYPES,
  'gongfa_manual',
  'skill_manual',
] as const;

/** Explicit immutable facts. Legacy arbitrary details are deliberately not executable rules. */
export const MaterialFactsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(INVENTORY_MATERIAL_TYPES),
    rank: z.enum(QUALITY_VALUES),
    element: z.enum(ELEMENT_VALUES).nullable().default(null),
    description: z.string().max(4000).default(''),
  })
  .strict();

export type MaterialFacts = z.infer<typeof MaterialFactsSchema>;
