import type {
  BattleInitConfigV5,
  BattleUnitInitSpec,
  PersistentCombatStatusV5,
  ResourcePointState,
} from '@shared/engine/battle-v5/setup/types';
import type { BattleRecordV3 } from '@shared/engine/battle-v5/v3';
import type { Cultivator } from '@shared/types/cultivator';

export type {
  BattleInitConfigV5,
  BattleUnitInitSpec,
  PersistentCombatStatusV5,
  ResourcePointState,
};

export type { BattleRecordV3 };

export type BattleRecordUnitSummary = Pick<Cultivator, 'id' | 'name'>;
