import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { z } from 'zod';
import raw from './data/encounters.json' with { type: 'json' };

const positive = z.number().positive().max(100);
const tier = z.strictObject({
  factor: positive,
  enemyStage: z.enum(REALM_STAGE_VALUES),
});

export const ExorcismEncounterPackShape = z.strictObject({
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  stages: z
    .array(
      z.strictObject({
        stage: z.number().int().min(1).max(4),
        rounds: positive,
        output: positive,
      }),
    )
    .length(4),
  tiers: z.strictObject({
    easy: tier,
    normal: tier,
    hard: tier,
    elite: tier,
    boss: tier,
  }),
  corrosion: z.strictObject({
    fromStage: z.number().int().min(1).max(4),
    startRound: z.number().int().min(1).max(50),
    hpRatio: z.number().min(0).max(1),
    hpRatioPerRound: z.number().min(0).max(1),
    healTaken: z.number().min(0).max(1),
  }),
  /** 首领战全程的祟气减疗，只影响靠治疗续航的构筑。 */
  taint: z.strictObject({
    stage: z.number().int().min(1).max(4),
    healTaken: z.number().min(0).max(1),
  }),
  supply: z.strictObject({
    restHpRatio: z.number().min(0).max(1),
    restMpRatio: z.number().min(0).max(1),
  }),
  grading: z.strictObject({ sHpRatio: z.number().min(0).max(1) }),
  /** 第三战与首领战敌人的封印抗性，避免单体敌人被控到死。 */
  bossSealResist: z.number().min(0).max(1000),
  /**
   * 按境界调整强度：低境界是刚上手的新玩家，化神以上的玩家经验丰富。
   * 炼气基线明显偏低，所以系数大于 1 仍比其他境界容易。
   */
  realmFactors: z.partialRecord(z.enum(REALM_VALUES), positive),
});

export function loadExorcismEncounterPack(data: unknown) {
  const result = ExorcismEncounterPackShape.superRefine((pack, ctx) => {
    pack.stages.forEach((row, index) => {
      if (row.stage !== index + 1)
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index, 'stage'],
          message: '场次必须按 1–4 排列',
        });
      const previous = pack.stages[index - 1];
      if (
        previous &&
        (row.rounds <= previous.rounds || row.output <= previous.output)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index],
          message: '强度必须逐场递增',
        });
    });
    const tiers = [
      pack.tiers.easy,
      pack.tiers.normal,
      pack.tiers.hard,
      pack.tiers.elite,
      pack.tiers.boss,
    ];
    tiers.forEach((row, index) => {
      if (index > 0 && row.factor <= tiers[index - 1].factor)
        ctx.addIssue({
          code: 'custom',
          path: ['tiers', index],
          message: '节点难度系数必须逐档递增',
        });
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors('除祟遭遇配置', data, result.error.issues),
    );
  return result.data;
}

export const EXORCISM_ENCOUNTER_PACK = loadExorcismEncounterPack(raw);
