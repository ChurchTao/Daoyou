import { z } from 'zod';

export function createBeastSchema(content: {
  skills: readonly { id: string }[];
  species: readonly { id: string }[];
}) {
  return z
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
      skillSlotCapacity: z.number().int().min(0).max(content.skills.length),
      skills: z.array(z.string()).max(content.skills.length),
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
        !content.species.some((s) => s.id === beast.speciesId) ||
        beast.skills.length !== beast.skillSlotCapacity ||
        new Set(beast.skills).size !== beast.skills.length ||
        beast.skills.some((id) => !content.skills.some((s) => s.id === id)) ||
        beast.currentLifespan > beast.maxLifespan ||
        (beast.originKind === 'wild' && beast.initialLevel < 1) ||
        (!!beast.isMutant && beast.originKind !== 'baby')
      )
        ctx.addIssue({ code: 'custom', message: '召唤兽个体事实不完整' });
    });
}

export const BEAST_VERSION = 'summoned_beast_v3';

const points = z.number().int().min(0).max(100000);

export type SummonedBeast = z.infer<ReturnType<typeof createBeastSchema>>;

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
