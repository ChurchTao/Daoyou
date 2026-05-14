import type { LogSpan } from '@shared/engine/battle-v5/systems/log/types';
import type {
  BattleStateTimeline,
  UnitStateSnapshot,
} from '@shared/engine/battle-v5/systems/state/types';
import type {
  BattleInitConfigV5,
  BattleUnitInitSpec,
  PersistentCombatStatusV5,
  ResourcePointState,
} from '@shared/engine/battle-v5/setup/types';
import type { Cultivator } from '@shared/types/cultivator';

export type {
  BattleInitConfigV5,
  BattleUnitInitSpec,
  PersistentCombatStatusV5,
  ResourcePointState,
};

export interface BattleRecord {
  winner: Cultivator;
  loser: Cultivator;
  logs: string[];
  turns: number;
  player: string;
  opponent: string;
  logSpans: LogSpan[];
  stateTimeline: BattleStateTimeline;
  winnerSnapshot: UnitStateSnapshot;
  loserSnapshot?: UnitStateSnapshot;
}

export type BattleViewRecord = BattleRecord;

export type BattleRecordType = 'challenge' | 'challenged' | 'normal';

export interface BattleRecordV2Summary {
  id: string;
  createdAt: Date | null;
  battleType: BattleRecordType;
  opponentCultivatorId: string | null;
  winner: Cultivator;
  loser: Cultivator;
  turns: number;
}

export interface BattleRecordV2Detail {
  id: string;
  createdAt: Date | null;
  battleResult: BattleRecord;
  battleReport?: string | null;
}

export function toViewRecord(record: BattleRecord): BattleViewRecord {
  return record;
}
