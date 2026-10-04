import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import type { ResolvedDungeonMapConfig } from '@daoyou/game-domain/world/map';
import type { RealmType } from '@daoyou/constants/realms';

export const DUNGEON_DIFFICULTY_PRESETS: Record<
  DungeonDifficultyTier,
  Pick<
    ResolvedDungeonMapConfig,
    | 'difficultyLabel'
    | 'allowedEnemyRealmStages'
    | 'allowBossLoadout'
    | 'rewardBonus'
  >
> = {
  easy: {
    difficultyLabel: '低危',
    allowedEnemyRealmStages: ['初期'],
    allowBossLoadout: false,
    rewardBonus: 1,
  },
  normal: {
    difficultyLabel: '普通',
    allowedEnemyRealmStages: ['初期', '中期'],
    allowBossLoadout: false,
    rewardBonus: 1.1,
  },
  hard: {
    difficultyLabel: '险地',
    allowedEnemyRealmStages: ['中期', '后期'],
    allowBossLoadout: false,
    rewardBonus: 1.2,
  },
  elite: {
    difficultyLabel: '凶险',
    allowedEnemyRealmStages: ['后期', '圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.3,
  },
  boss: {
    difficultyLabel: '绝境',
    allowedEnemyRealmStages: ['圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.5,
  },
};

export const DUNGEON_ENEMY_DIFFICULTY_TABLE: Record<
  RealmType,
  Record<DungeonDifficultyTier, number>
> = {
  炼气: { easy: 10, normal: 20, hard: 35, elite: 55, boss: 75 },
  筑基: { easy: 12, normal: 24, hard: 40, elite: 60, boss: 80 },
  金丹: { easy: 15, normal: 28, hard: 45, elite: 65, boss: 85 },
  元婴: { easy: 18, normal: 32, hard: 50, elite: 70, boss: 88 },
  化神: { easy: 20, normal: 36, hard: 55, elite: 74, boss: 90 },
  炼虚: { easy: 22, normal: 38, hard: 58, elite: 76, boss: 92 },
  合体: { easy: 24, normal: 40, hard: 60, elite: 78, boss: 94 },
  大乘: { easy: 26, normal: 42, hard: 62, elite: 80, boss: 95 },
  渡劫: { easy: 28, normal: 45, hard: 65, elite: 82, boss: 96 },
};
