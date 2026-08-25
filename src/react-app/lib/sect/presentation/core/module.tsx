import {
  AbandonAction,
  AcceptAction,
  BattleAction,
  ClaimAction,
  DungeonEntryAction,
  ItemDeliveryAction,
  MiningEntryAction,
  SweepEntryAction,
} from '@app/components/feature/sect/SectTaskActions';
import {
  BattleOutcome,
  CompletedOutcome,
  MiningResultOutcome,
  MiningSessionOutcome,
  RewardClaimedOutcome,
  SweepSessionOutcome,
} from '@app/components/feature/sect/SectTaskOutcomeRenderers';
import type {
  SectBattleOutcomeData,
  SectMiningResultData,
  SectMiningSessionData,
  SectSweepSessionData,
  SectTaskRewardReceipt,
} from '@shared/contracts/sect';
import type { BattleRecordV3 } from '@shared/types/battle';
import { z } from 'zod';
import type {
  DecodedSectTaskOutcome,
  SectTaskRendererPluginManifest,
} from './registry';

const sweepSessionSchema = z.object({
  sessionId: z.string(),
  seed: z.string(),
  rulesVersion: z.number(),
  expiresAt: z.string(),
});
const miningSessionSchema = z.object({
  sessionId: z.string(),
  seed: z.string(),
  rulesVersion: z.number(),
  startedAt: z.string(),
  expiresAt: z.string(),
  durationMs: z.number().int().positive(),
});
const miningResultSchema = z.object({
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().positive(),
  ratio: z.number().min(0).max(1),
  tier: z.enum(['D', 'C', 'B', 'A', 'S']).optional(),
  qualified: z.boolean(),
  collected: z.number().int().nonnegative(),
  destroyed: z.number().int().nonnegative(),
  clearedAll: z.boolean(),
  ores: z.array(
    z.object({
      kind: z.enum([
        'spirit_crystal',
        'copper_ore',
        'dark_iron',
        'earth_essence',
      ]),
      count: z.number().int().positive(),
      score: z.number().int().positive(),
    }),
  ),
  rewardSummary: z.array(z.string()).optional(),
});

const battleUnitSchema = z
  .object({ id: z.string(), name: z.string() })
  .passthrough();
const battleResourceSchema = z
  .object({
    current: z.number(),
    max: z.number(),
    percent: z.number(),
  })
  .passthrough();
const battleSnapshotSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    alive: z.boolean(),
    hp: battleResourceSchema,
    mp: battleResourceSchema,
  })
  .passthrough();
const battleRecordEnvelopeSchema = z
  .object({
    participants: z.object({
      player: battleUnitSchema,
      opponent: battleUnitSchema,
    }),
    outcome: z.object({
      winner: battleUnitSchema,
      loser: battleUnitSchema,
      turns: z.number().int().nonnegative(),
    }),
    sequences: z.array(
      z
        .object({
          id: z.string(),
          turn: z.number().int().nonnegative(),
          phase: z.string(),
          facts: z.array(z.unknown()),
        })
        .passthrough(),
    ),
    stateTimeline: z
      .object({
        frames: z.array(z.unknown()),
        unitIds: z.array(z.string()),
        unitNames: z.record(z.string(), z.string()),
      })
      .passthrough(),
    finalSnapshots: z.object({
      winner: battleSnapshotSchema,
      loser: battleSnapshotSchema.optional(),
    }),
  })
  .passthrough();
const battleRecordSchema = z.custom<BattleRecordV3>(
  (value) => battleRecordEnvelopeSchema.safeParse(value).success,
);
const battleOutcomeSchema = z.object({
  battle: battleRecordSchema,
  won: z.boolean(),
  challengeTitle: z.string(),
  taskFulfilled: z.boolean(),
});
const rewardReceiptSchema = z.object({
  taskRecordId: z.string(),
  claimedAt: z.string(),
  rewards: z.object({
    contribution: z.number().int().nonnegative(),
    cultivationExp: z.number().int().nonnegative(),
    spiritStones: z.number().int().nonnegative(),
  }),
  lines: z.array(z.string()),
});

export const CORE_SECT_TASK_RENDERER_PLUGIN: SectTaskRendererPluginManifest = {
  sectId: '*',
  actions: [
    { key: 'sect.action.accept', renderer: AcceptAction },
    { key: 'sect.action.abandon', renderer: AbandonAction },
    { key: 'sect.action.battle', renderer: BattleAction },
    { key: 'sect.action.dungeon-entry', renderer: DungeonEntryAction },
    { key: 'sect.action.sweep-entry', renderer: SweepEntryAction },
    { key: 'sect.action.mining-entry', renderer: MiningEntryAction },
    { key: 'sect.action.item-delivery', renderer: ItemDeliveryAction },
    { key: 'sect.action.claim', renderer: ClaimAction },
  ],
  outcomes: [
    {
      key: 'sect.outcome.sweep-session',
      schema: sweepSessionSchema,
      renderer: SweepSessionOutcome,
    },
    {
      key: 'sect.outcome.mining-session',
      schema: miningSessionSchema,
      renderer: MiningSessionOutcome,
    },
    {
      key: 'sect.outcome.mining-result',
      schema: miningResultSchema,
      renderer: MiningResultOutcome,
    },
    {
      key: 'sect.outcome.battle',
      schema: battleOutcomeSchema,
      renderer: BattleOutcome,
    },
    {
      key: 'sect.outcome.accepted',
      schema: z.record(z.string(), z.unknown()),
      renderer: CompletedOutcome,
    },
    {
      key: 'sect.outcome.abandoned',
      schema: z.object({ abandoned: z.literal(true) }),
      renderer: CompletedOutcome,
    },
    {
      key: 'sect.outcome.fulfilled',
      schema: z.record(z.string(), z.unknown()),
      renderer: CompletedOutcome,
    },
    {
      key: 'sect.outcome.reward-claimed',
      schema: rewardReceiptSchema,
      renderer: RewardClaimedOutcome,
    },
  ],
};

export function readSweepSessionOutcome(
  outcome: DecodedSectTaskOutcome,
): SectSweepSessionData | undefined {
  if (outcome.renderer !== 'sect.outcome.sweep-session') return undefined;
  const parsed = sweepSessionSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}

export function readMiningSessionOutcome(
  outcome: DecodedSectTaskOutcome,
): SectMiningSessionData | undefined {
  if (outcome.renderer !== 'sect.outcome.mining-session') return undefined;
  const parsed = miningSessionSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}

export function readMiningResultOutcome(
  outcome: DecodedSectTaskOutcome,
): SectMiningResultData | undefined {
  if (outcome.renderer !== 'sect.outcome.mining-result') return undefined;
  const parsed = miningResultSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}

export function readBattleOutcome(
  outcome: DecodedSectTaskOutcome,
): SectBattleOutcomeData | undefined {
  if (outcome.renderer !== 'sect.outcome.battle') return undefined;
  const parsed = battleOutcomeSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}

export function readRewardReceiptOutcome(
  outcome: DecodedSectTaskOutcome,
): SectTaskRewardReceipt | undefined {
  if (outcome.renderer !== 'sect.outcome.reward-claimed') return undefined;
  const parsed = rewardReceiptSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}
