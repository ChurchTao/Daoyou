import type {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@daoyou/game-domain/dungeon';
import type { ResourceOperation } from '@daoyou/game-domain/resources';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}
