import {
  SectTaskRewardSnapshotSchema,
  type SectTaskRewardSnapshot,
} from '@daoyou/game-domain/sects/tasks';
import {
  DAILY_TASK_EXP_BUDGET,
  REALM_DAILY_EXP_BUDGET,
} from '@daoyou/game-content/cultivation';

import type { DailyTaskDifficulty } from '@daoyou/game-domain/cultivation';

import { REALM_ORDER } from '@daoyou/constants/realms';

import type { RealmStage, RealmType } from '@daoyou/constants/realms';

export const STANDARD_SECT_TASK_REWARD_CURVE = {
  cultivationFraction: DAILY_TASK_EXP_BUDGET.difficultyDailyFraction,
  cadenceMultiplier: {
    daily: 1,
    weekly: 3,
  },
  spiritStoneMultiplier: 5,
  spiritStoneRoundUnit: 100,
  contributionDifficultyMultiplierBps: {
    easy: 10_000,
    normal: 11_500,
    hard: 13_500,
    elite: 16_000,
  },
} as const;

export const SECT_TASK_DIFFICULTY_MULTIPLIER_BPS =
  STANDARD_SECT_TASK_REWARD_CURVE.contributionDifficultyMultiplierBps;

export type SectTaskRewardCadence =
  keyof typeof STANDARD_SECT_TASK_REWARD_CURVE.cadenceMultiplier;

const SECT_TASK_DIFFICULTY_ORDER = [
  'easy',
  'normal',
  'hard',
  'elite',
] as const satisfies readonly DailyTaskDifficulty[];

export interface RealmTaskRewardInput {
  baseContribution: number;
}

function safeRound(value: number, label: string): number {
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || rounded < 0)
    throw new Error(`宗门任务${label}奖励无效`);
  return rounded;
}

function safeFloor(value: number, label: string): number {
  const floored = Math.floor(value);
  if (!Number.isSafeInteger(floored) || floored < 0)
    throw new Error(`宗门任务${label}奖励无效`);
  return floored;
}

function roundBpsToUnit(valueTimesBps: number, unit: number): number {
  return Math.round(valueTimesBps / (10_000 * unit)) * unit;
}

function roundUpToUnit(value: number, unit: number): number {
  return Math.ceil(value / unit) * unit;
}

export function resolveSectTaskDifficulty(
  minimum: DailyTaskDifficulty = 'easy',
  generated: DailyTaskDifficulty = 'easy',
): DailyTaskDifficulty {
  return SECT_TASK_DIFFICULTY_ORDER.indexOf(generated) >
    SECT_TASK_DIFFICULTY_ORDER.indexOf(minimum)
    ? generated
    : minimum;
}

export function calculateRealmSectTaskReward(input: {
  realm: RealmType;
  realmStage: RealmStage;
  difficulty: DailyTaskDifficulty;
  cadence: SectTaskRewardCadence;
  reward: RealmTaskRewardInput;
}): SectTaskRewardSnapshot {
  if (
    !Number.isSafeInteger(input.reward.baseContribution) ||
    input.reward.baseContribution < 0
  )
    throw new Error('宗门任务奖励配置无效');
  const difficultyBps = SECT_TASK_DIFFICULTY_MULTIPLIER_BPS[input.difficulty];
  const cadenceMultiplier =
    STANDARD_SECT_TASK_REWARD_CURVE.cadenceMultiplier[input.cadence];
  const contribution = safeRound(
    (input.reward.baseContribution * difficultyBps) / 10_000,
    '贡献',
  );
  const realmStoneBase = (REALM_ORDER[input.realm] + 1) * 1_000;
  const spiritStoneFloor = safeRound(
    roundBpsToUnit(
      realmStoneBase * cadenceMultiplier * difficultyBps,
      STANDARD_SECT_TASK_REWARD_CURVE.spiritStoneRoundUnit,
    ),
    '灵石',
  );
  const cultivationExp = safeFloor(
    REALM_DAILY_EXP_BUDGET[input.realm] *
      STANDARD_SECT_TASK_REWARD_CURVE.cultivationFraction[input.difficulty] *
      cadenceMultiplier,
    '修为',
  );
  const spiritStones = Math.max(
    spiritStoneFloor,
    roundUpToUnit(
      cultivationExp * STANDARD_SECT_TASK_REWARD_CURVE.spiritStoneMultiplier,
      STANDARD_SECT_TASK_REWARD_CURVE.spiritStoneRoundUnit,
    ),
  );
  return SectTaskRewardSnapshotSchema.parse({
    policyKey: 'sect.reward.realm-task',
    policyVersion: 3,
    difficulty: input.difficulty,
    contribution,
    cultivationExp,
    spiritStones,
    summary: [
      `宗门贡献 +${contribution}`,
      `修为 +${cultivationExp}`,
      `灵石 +${spiritStones}`,
    ],
    grants: [],
  });
}
