import type {
  BattleEvent,
  BattleState,
  Command,
  LineupUnit,
  SkillDef,
  StatusDef,
} from '@shared/engine/combat-v6/core';
import { z } from 'zod';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';
import { CombatV6CommandGroupSchema } from './combatV6';
import type { CombatV6ReplayTimeline } from './combatV6Replay';

export const ARENA_V6_PROTOCOL = 'combat_v6_arena_v1' as const;
export const ARENA_PUBLIC_VIEW = '__spectator__';
export const ArenaV6SubmitSchema = z
  .object({
    round: z.number().int().positive(),
    requestId: z.uuid(),
    commands: z.union([CombatV6CommandGroupSchema, z.literal('AUTO')]),
  })
  .strict();
export type ArenaV6Submit = z.infer<typeof ArenaV6SubmitSchema>;
export type ArenaParticipant = {
  userId: string;
  cultivatorId: string;
  unitId: string;
  side: 0 | 1;
  slot: number;
};
export type ArenaRuntime = {
  timeline: CombatV6ReplayTimeline;
  protocol: typeof ARENA_V6_PROTOCOL;
  battleId: string;
  roomId: string;
  startRequestId: string;
  participants: ArenaParticipant[];
  seed: number;
  units: LineupUnit[];
  skills: SkillDef[];
  statusDefs: StatusDef[];
  state: BattleState;
  events: BattleEvent[];
  rounds: Array<{
    round: number;
    commands: Array<{ unitId: string; command: Command }>;
  }>;
  revision: number;
  stage: 'collecting' | 'resolving' | 'playback' | 'finished';
  createdAt: number;
  expiresAt: number;
  deadlineAt: number;
  playbackEndsAt: number;
  commands: Record<
    string,
    {
      requestId: string;
      command: Command;
      automatic?: boolean;
    }
  >;
  receipts: Record<
    string,
    { round: number; unitId: string; commands: ArenaV6Submit['commands'] }
  >;
  terminalReason?: 'battle-ended' | 'expired' | 'technical-abort';
  lastResults: Record<string, ArenaSessionView>;
};
export type ArenaSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'tier' | 'encounterId'
> & {
  protocol: typeof ARENA_V6_PROTOCOL;
  roomId: string;
  controlledUnitId: string;
  spectator?: boolean;
  stage: ArenaRuntime['stage'];
  serverNow: number;
  commandOpensAt: number;
  commandDeadlineAt: number;
  playbackEndsAt: number;
  submittedUnitIds: string[];
  terminalReason?: ArenaRuntime['terminalReason'];
};
export type ArenaSocketMessage =
  | { type: 'ready' | 'ping'; serverNow: number }
  | { type: 'state'; session: ArenaSessionView }
  | { type: 'resync'; revision: number };
