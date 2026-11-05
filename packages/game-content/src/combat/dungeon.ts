import type { DungeonTemplate } from '@daoyou/game-domain/combat/challenges';
import { DUNGEON_ENEMY_PACK } from './dungeon-enemies.js';

export {
  DUNGEON_ENEMY_PACK,
  DungeonEnemyPackShape,
  loadDungeonEnemyPack,
} from './dungeon-enemies.js';

export const DUNGEON_TEMPLATES = {
  normal: {
    name: '秘境守卫',
    count: DUNGEON_ENEMY_PACK.kinds.normal.count,
    icon: 'icon:portrait-puppet',
  },
  elite: {
    name: '秘境精锐',
    count: DUNGEON_ENEMY_PACK.kinds.elite.count,
    icon: 'icon:portrait-yaoguai',
  },
  boss: {
    name: '秘境镇守',
    count: DUNGEON_ENEMY_PACK.kinds.boss.count,
    icon: 'icon:portrait-spirit',
  },
} as const satisfies Record<DungeonTemplate, { name: string; count: number; icon: string }>;
