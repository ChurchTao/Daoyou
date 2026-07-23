import {
  AcceptAction,
  BattleAction,
  ItemDeliveryAction,
  SweepAction,
} from '@app/components/feature/sect/SectTaskActions';
import {
  BattleOutcome,
  CompletedOutcome,
  SweepSessionOutcome,
} from '@app/components/feature/sect/SectTaskOutcomeRenderers';
import type {
  SectBattleOutcomeData,
  SectSweepSessionData,
} from '@shared/contracts/sect';
import type { BattleRecord } from '@shared/types/battle';
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
    winner: battleUnitSchema,
    loser: battleUnitSchema,
    logs: z.array(z.string()),
    turns: z.number().int().nonnegative(),
    player: z.string(),
    opponent: z.string(),
    logSpans: z.array(z.unknown()),
    stateTimeline: z
      .object({
        frames: z.array(z.unknown()),
        unitIds: z.array(z.string()),
        unitNames: z.record(z.string(), z.string()),
      })
      .passthrough(),
    winnerSnapshot: battleSnapshotSchema,
    loserSnapshot: battleSnapshotSchema.optional(),
  })
  .passthrough();
const battleRecordSchema = z.custom<BattleRecord>(
  (value) => battleRecordEnvelopeSchema.safeParse(value).success,
);
const battleOutcomeSchema = z.object({
  battle: battleRecordSchema,
  won: z.boolean(),
  challengeTitle: z.string(),
  rewardGranted: z.boolean(),
});

export const CORE_SECT_TASK_RENDERER_PLUGIN: SectTaskRendererPluginManifest = {
  sectId: '*',
  actions: [
    { key: 'sect.action.accept', renderer: AcceptAction },
    { key: 'sect.action.battle', renderer: BattleAction },
    { key: 'sect.action.sweep', renderer: SweepAction },
    { key: 'sect.action.item-delivery', renderer: ItemDeliveryAction },
  ],
  outcomes: [
    {
      key: 'sect.outcome.sweep-session',
      schema: sweepSessionSchema,
      renderer: SweepSessionOutcome,
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
      key: 'sect.outcome.completed',
      schema: z.record(z.string(), z.unknown()),
      renderer: CompletedOutcome,
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

export function readBattleOutcome(
  outcome: DecodedSectTaskOutcome,
): SectBattleOutcomeData | undefined {
  if (outcome.renderer !== 'sect.outcome.battle') return undefined;
  const parsed = battleOutcomeSchema.safeParse(outcome.data);
  return parsed.success ? parsed.data : undefined;
}
