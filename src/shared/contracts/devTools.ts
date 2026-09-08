import { z } from 'zod';
import { REALM_STAGE_VALUES, REALM_VALUES } from '../types/constants';

const attribute = z.number().int().min(1).max(10000);
export const DevCultivatorPatchSchema = z
  .object({
    realm: z.enum(REALM_VALUES).optional(),
    realmStage: z.enum(REALM_STAGE_VALUES).optional(),
    attributes: z
      .object({
        vitality: attribute.optional(),
        strength: attribute.optional(),
        spirit: attribute.optional(),
        endurance: attribute.optional(),
        speed: attribute.optional(),
        willpower: attribute.optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, '属性不能为空')
      .optional(),
    unallocatedAttributePoints: z.number().int().min(0).max(100000).optional(),
    spiritStones: z.number().int().min(0).max(100000000).optional(),
    reputation: z.number().int().min(0).max(1000000).optional(),
    resources: z
      .object({
        hp: z.number().int().min(0).max(10000000),
        mp: z.number().int().min(0).max(10000000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, '至少指定一个调整字段');
export type DevCultivatorPatch = z.infer<typeof DevCultivatorPatchSchema>;
