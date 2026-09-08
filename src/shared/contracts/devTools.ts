import { z } from 'zod';
import { SECT_DISCIPLE_RANKS } from '../engine/sect/core/domain/organization';
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
    cultivation: z.object({
      experience: z.number().int().min(0).max(1000000000000).optional(),
      insight: z.number().int().min(0).max(100).optional(),
    }).strict().refine((v) => Object.keys(v).length > 0, '修炼调整不能为空').optional(),
    breakthroughPreparation: z.object({
      clearMind: z.boolean().optional(),
      protectMeridians: z.boolean().optional(),
      completedDungeonObjectiveIds: z.array(z.string().min(1).max(120)).min(1).max(10).optional(),
    }).strict().refine((v) => Object.keys(v).length > 0, '试炼准备不能为空').optional(),
    sect: z
      .object({
        discipleRank: z.enum(SECT_DISCIPLE_RANKS).optional(),
        contribution: z.number().int().min(0).max(100000000).optional(),
        lifetimeContribution: z.number().int().min(0).max(100000000).optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, '宗门调整不能为空')
      .optional(),
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
