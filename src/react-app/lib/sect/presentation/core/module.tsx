import {
  AcceptAction,
  BattleAction,
  ItemDeliveryAction,
  SweepAction,
} from '@app/components/feature/sect/SectTaskActions';
import type {
  SectBattleOutcomeData,
  SectSweepSessionData,
} from '@shared/contracts/sect';
import type { BattleRecord } from '@shared/types/battle';
import { z } from 'zod';
import type {
  DecodedSectTaskOutcome,
  SectPresentationPluginManifest,
} from './registry';

const sweepSessionSchema = z.object({
  sessionId: z.string(),
  seed: z.string(),
  rulesVersion: z.number(),
  tickRate: z.number(),
  maxTicks: z.number(),
  expiresAt: z.string(),
});

const battleRecordSchema = z.custom<BattleRecord>(
  (value) => Boolean(value && typeof value === 'object'),
);
const battleOutcomeSchema = z.object({
  battle: battleRecordSchema,
  won: z.boolean(),
  challengeTitle: z.string(),
  rewardGranted: z.boolean(),
});

export const CORE_SECT_PRESENTATION_PLUGIN: SectPresentationPluginManifest = {
  sectId: '*',
  actions: [
    { key: 'sect.action.accept', renderer: AcceptAction },
    { key: 'sect.action.battle', renderer: BattleAction },
    { key: 'sect.action.sweep', renderer: SweepAction },
    { key: 'sect.action.item-delivery', renderer: ItemDeliveryAction },
  ],
  outcomes: [
    { key: 'sect.outcome.sweep-session', schema: sweepSessionSchema },
    { key: 'sect.outcome.battle', schema: battleOutcomeSchema },
    { key: 'sect.outcome.accepted', schema: z.record(z.string(), z.unknown()) },
    { key: 'sect.outcome.completed', schema: z.record(z.string(), z.unknown()) },
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
