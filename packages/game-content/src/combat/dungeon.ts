import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import type { DungeonTemplate } from '@daoyou/game-domain/combat/challenges';


export const DUNGEON_TEMPLATES = {
  normal: { name: '秘境守卫', count: 1 },
  elite: { name: '秘境精锐', count: 2 },
  boss: { name: '秘境镇守', count: 1 },
} as const satisfies Record<DungeonTemplate, { name: string; count: number }>;


export const MAP_DIFFICULTY_SCALE: Record<DungeonDifficultyTier, number> = {
  easy: 0.8,
  normal: 1,
  hard: 1.15,
  elite: 1.3,
  boss: 1.5,
};
