import { z } from 'zod';
import { BEAST_PROGRESSION, BEAST_SKILLS, BEAST_SPECIES } from './content';

export const BEAST_VERSION = 'summoned_beast_v1';
const points = z.number().int().min(0).max(100000);
export const BeastSchema = z
  .object({
    id: z.uuid(),
    ownerCultivatorId: z.uuid(),
    speciesId: z.string(),
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
    skillSlotCapacity: z.number().int().min(0).max(8),
    skills: z.array(z.string()).max(8),
    currentLifespan: points,
    maxLifespan: points,
    generationVersion: z.enum([BEAST_VERSION, 'summoned_beast_capture_v1']),
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
      Object.values(beast.allocatedAttributes).reduce((a, b) => a + b, 0) +
        beast.unallocatedPoints !==
        beast.level * BEAST_PROGRESSION.pointsPerLevel
    )
      ctx.addIssue({ code: 'custom', message: '召唤兽个体事实不完整' });
  });
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
