import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/encounters.json';

const positive = z.number().positive().max(1000000);
const baseline = z.strictObject({
  referencePhysicalDef: positive,
  referenceMagicDef: positive,
  damagePerRound: positive,
  physicalAtk: positive,
  magicAtk: positive,
  physicalDef: positive,
  magicDef: positive,
  speed: positive,
  hit: positive,
  dodge: positive,
});
const scale = z.strictObject({
  rounds: z.number().min(1).max(12),
  output: positive,
});
export const TowerEncounterPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(3),
  contentRevision: z.number().int().positive(),
  minRealm: z.literal('金丹'),
  difficultyStep: positive.int(),
  floors: z
    .array(
      z.strictObject({
        floor: z.number().int().min(1).max(20),
        kind: z.enum(['normal', 'elite', 'boss']),
        realmStage: z.literal('中期'),
        milestone: z.enum(['C', 'B', 'A', 'S']).nullable(),
      }),
    )
    .length(20),
  scaling: z.strictObject({
    hpGrowth: z.number().min(0).max(0.1),
    outputGrowth: z.number().min(0).max(0.1),
    defenseGrowth: z.number().min(0).max(0.01),
    types: z.strictObject({ normal: scale, elite: scale, boss: scale }),
  }),
  baselines: z.strictObject({
    金丹: baseline,
    元婴: baseline,
    化神: baseline,
    炼虚: baseline,
    合体: baseline,
    大乘: baseline,
    渡劫: baseline,
  }),
});
export function loadTowerEncounterPack(data: unknown) {
  const result = TowerEncounterPackShape.superRefine((pack, ctx) => {
    const tiers = ['C', 'B', 'A', 'S'];
    pack.floors.forEach((floor, i) => {
      if (floor.floor !== i + 1)
        ctx.addIssue({
          code: 'custom',
          path: ['floors', i],
          message: '楼层必须从1连续递增',
        });
      const expectedKind =
        floor.floor % 10 === 0
          ? 'boss'
          : floor.floor % 5 === 0
            ? 'elite'
            : 'normal';
      if (
        floor.kind !== expectedKind ||
        floor.milestone !==
          (floor.floor % 5 === 0 ? tiers[floor.floor / 5 - 1] : null)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['floors', i],
          message: '关键层与里程碑必须对应',
        });
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'tower/data/encounters.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export const TOWER_ENCOUNTER_PACK = loadTowerEncounterPack(raw);
