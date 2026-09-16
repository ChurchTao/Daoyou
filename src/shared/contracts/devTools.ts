import { z } from 'zod';
import { SECT_DISCIPLE_RANKS } from '../engine/sect/core/domain/organization';
import { SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP } from '../lib/marrowWash';
import {
  ELEMENT_VALUES,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '../types/constants';

const attribute = z.number().int().min(1).max(10000);
export const DevCultivatorPatchSchema = z
  .object({
    spiritField: z
      .object({ finishGrowth: z.number().int().min(0).max(5) })
      .strict()
      .optional(),
    spiritualRoots: z
      .array(
        z
          .object({
            element: z.enum(ELEMENT_VALUES),
            baseStrength: z.number().int().min(0).max(100),
            marrowWashBonus: z
              .number()
              .int()
              .min(0)
              .max(SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP)
              .default(0),
          })
          .strict()
          .refine(
            (root) =>
              root.baseStrength + root.marrowWashBonus <=
              SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
            '灵根总强度不能超过120',
          ),
      )
      .max(ELEMENT_VALUES.length)
      .refine(
        (roots) =>
          new Set(roots.map((root) => root.element)).size === roots.length,
        '灵根元素不能重复',
      )
      .optional(),
    preHeavenFates: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            quality: z.enum(QUALITY_VALUES),
            description: z.string().trim().min(1).max(2000).optional(),
            effectIds: z
              .array(z.string().trim().min(1).max(100))
              .min(1)
              .max(2)
              .refine(
                (ids) => new Set(ids).size === ids.length,
                '命格效果不能重复',
              ),
          })
          .strict(),
      )
      .max(3)
      .optional(),
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
    sectCombat: z
      .object({
        methods: z
          .record(z.string().min(1).max(120), z.number().int().min(1).max(180))
          .refine(
            (v) => Object.keys(v).length > 0 && Object.keys(v).length <= 6,
            '指定1至6本心法',
          )
          .optional(),
        meridianDepth: z.number().int().min(0).max(7).optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, '宗门构筑调整不能为空')
      .optional(),
    cultivation: z
      .object({
        experience: z.number().int().min(0).max(1000000000000).optional(),
        insight: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, '修炼调整不能为空')
      .optional(),
    breakthroughPreparation: z
      .object({
        clearMind: z.boolean().optional(),
        protectMeridians: z.boolean().optional(),
        completedDungeonObjectiveIds: z
          .array(z.string().min(1).max(120))
          .min(1)
          .max(10)
          .optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, '试炼准备不能为空')
      .optional(),
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
