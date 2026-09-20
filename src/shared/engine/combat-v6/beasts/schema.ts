import { z } from 'zod';
import { BEAST_SKILLS, BEAST_SPECIES } from './content';
import { beastPointBudget } from './identity';

export const BEAST_VERSION = 'summoned_beast_v3';
const points = z.number().int().min(0).max(100000);
export const BeastSchema = z
  .object({
    id: z.uuid(),
    ownerCultivatorId: z.uuid(),
    speciesId: z.string(),
    isMutant: z.boolean().optional(),
    originKind: z.enum(['baby', 'pseudo_baby', 'wild']),
    initialLevel: z.number().int().min(0).max(180),
    name: z.string().min(1).max(40),
    level: z.number().int().min(0).max(180),
    exp: points,
    growth: z.number().min(0.1).max(3),
    aptitudes: z
      .object({
        attack: points,
        defense: points,
        health: points,
        mana: points,
        speed: points,
      })
      .strict(),
    allocatedAttributes: z
      .object({
        constitution: points,
        strength: points,
        magic: points,
        endurance: points,
        agility: points,
      })
      .strict(),
    unallocatedPoints: points,
    skillSlotCapacity: z.number().int().min(0).max(BEAST_SKILLS.length),
    skills: z.array(z.string()).max(BEAST_SKILLS.length),
    currentLifespan: points,
    maxLifespan: points,
    generationVersion: z.enum([BEAST_VERSION, 'summoned_beast_fusion_v1']),
    generationContentRevision: z.number().int().positive().optional(),
    generationSeed: z.number().int(),
    revision: points,
  })
  .strict()
  .superRefine((beast, ctx) => {
    if (
      !BEAST_SPECIES.some((s) => s.id === beast.speciesId) ||
      beast.skills.length !== beast.skillSlotCapacity ||
      new Set(beast.skills).size !== beast.skills.length ||
      beast.skills.some((id) => !BEAST_SKILLS.some((s) => s.id === id)) ||
      beast.currentLifespan > beast.maxLifespan ||
      beast.level < beast.initialLevel ||
      (beast.originKind === 'wild' && beast.initialLevel < 1) ||
      (!!beast.isMutant && beast.originKind !== 'baby')
    )
      ctx.addIssue({ code: 'custom', message: '召唤兽个体事实不完整' });
  });
// 点数公式只约束生成、融合和洗炼的结果，不阻断存量个体读取。
export const GeneratedBeastSchema = BeastSchema.refine(
  (beast) =>
    Object.values(beast.allocatedAttributes).reduce((a, b) => a + b, 0) +
      beast.unallocatedPoints ===
    beastPointBudget(beast),
  { path: ['unallocatedPoints'], message: '灵兽属性点总额不符合生成规则' },
);
export type SummonedBeast = z.infer<typeof BeastSchema>;
export const BeastLineupSchema = z
  .object({
    carriedBeastIds: z.array(z.uuid()).max(6),
    leadBeastId: z.uuid().optional(),
    revision: points,
  })
  .strict()
  .superRefine((lineup, ctx) => {
    if (
      new Set(lineup.carriedBeastIds).size !== lineup.carriedBeastIds.length ||
      (lineup.leadBeastId &&
        !lineup.carriedBeastIds.includes(lineup.leadBeastId))
    )
      ctx.addIssue({ code: 'custom', message: '携带编组或首发无效' });
  });
export type BeastLineup = z.infer<typeof BeastLineupSchema>;
export type BeastRoster = { beasts: SummonedBeast[]; lineup: BeastLineup };
