import type { DungeonTemplate } from '@daoyou/game-domain/combat/challenges';
import { DUNGEON_ENEMY_PACK } from './dungeon-enemies.js';

export {
  DUNGEON_ENEMY_PACK,
  DungeonEnemyPackShape,
  loadDungeonEnemyPack,
} from './dungeon-enemies.js';

export const DUNGEON_TEMPLATES = {
  normal: { name: '秘境守卫', count: DUNGEON_ENEMY_PACK.kinds.normal.count },
  elite: { name: '秘境精锐', count: DUNGEON_ENEMY_PACK.kinds.elite.count },
  boss: { name: '秘境镇守', count: DUNGEON_ENEMY_PACK.kinds.boss.count },
} as const satisfies Record<DungeonTemplate, { name: string; count: number }>;
