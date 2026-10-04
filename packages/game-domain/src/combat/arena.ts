import type { AutoStrategy } from './auto-strategy.js';
import type {
  BattleEvent,
  BattleState,
  Command,
  LineupUnit,
  SkillDef,
  StatusDef,
} from '@daoyou/combat-core/types';
import type { HuntEvent } from '../hunts/event.js';
import type { HuntRewardSnapshot } from '../hunts/reward.js';
import type { CombatV6ReplayTimeline } from './replay.js';
import type { CombatV6CommandGroupSchema } from './commands.js';
import type { CombatV6SessionSnapshot } from './session-view.js';
import type { z } from 'zod';
export const ARENA_PUBLIC_VIEW = '__spectator__';
export type ArenaParticipant = {
  userId: string;
  cultivatorId: string;
  unitId: string;
  side: 0 | 1;
  slot: number;
};
export type ArenaState<TView = ArenaSnapshot> = {
  hunt?: HuntEvent;
  /** Absent on legacy, isolated full-resource hunts. */
  huntResourcePolicy?: 'persistent';
  huntRewards?: Record<string, HuntRewardSnapshot>;
  timeline: CombatV6ReplayTimeline;

  battleId: string;
  roomId: string;
  startRequestId: string;
  participants: ArenaParticipant[];
  seed: number;
  units: LineupUnit[];
  skills: SkillDef[];
  statusDefs: StatusDef[];
  autoStrategies?: Record<string, AutoStrategy>;
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
    {
      round: number;
      unitId: string;
      commands: z.infer<typeof CombatV6CommandGroupSchema> | 'AUTO';
    }
  >;
  terminalReason?: 'battle-ended' | 'expired' | 'technical-abort';
  lastResults: Record<string, TView>;
};
export type ArenaSnapshot = CombatV6SessionSnapshot & {
  hunt?: HuntEvent;
  roomId: string;
  controlledUnitId: string;
  spectator?: boolean;
  stage: ArenaState['stage'];
  serverNow: number;
  commandOpensAt: number;
  commandDeadlineAt: number;
  playbackEndsAt: number;
  submittedUnitIds: string[];
  terminalReason?: ArenaState['terminalReason'];
};
