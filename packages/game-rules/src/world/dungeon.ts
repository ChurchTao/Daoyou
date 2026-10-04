import { DUNGEON_DIFFICULTY_PRESETS, DUNGEON_ENEMY_DIFFICULTY_TABLE } from '@daoyou/game-content/world/dungeon';

import type { ResolvedDungeonMapConfig, MapNodeInfo } from '@daoyou/game-domain/world/map';

import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';

import type { RealmStage } from '@daoyou/constants/realms';

import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';

export function resolveDungeonMapConfig(
  node: MapNodeInfo,
): ResolvedDungeonMapConfig {
  const configuredTier = node.dungeon_config?.difficulty;
  const difficultyTier =
    configuredTier && configuredTier in DUNGEON_DIFFICULTY_PRESETS
      ? configuredTier
      : 'normal';
  const preset = DUNGEON_DIFFICULTY_PRESETS[difficultyTier];

  return {
    realmRequirement: node.realm_requirement,
    difficultyTier,
    enemyDifficulty: resolveDungeonEnemyDifficulty(
      node.realm_requirement,
      difficultyTier,
    ),
    ...preset,
  };
}

export function resolveDungeonEnemyDifficulty(
  realm: RealmType,
  tier: DungeonDifficultyTier,
): number {
  return DUNGEON_ENEMY_DIFFICULTY_TABLE[realm]?.[tier] ?? 24;
}

export function canChallengeDungeonRealm(
  playerRealm: RealmType,
  dungeonRealm: RealmType,
): boolean {
  return REALM_ORDER[playerRealm] >= REALM_ORDER[dungeonRealm];
}

export function clampDungeonEnemyRealmStage(
  realmStage: RealmStage,
  config: ResolvedDungeonMapConfig,
): RealmStage {
  if (config.allowedEnemyRealmStages.includes(realmStage)) {
    return realmStage;
  }

  if (realmStage === '初期' || realmStage === '中期') {
    return config.allowedEnemyRealmStages[0] ?? '初期';
  }

  return (
    config.allowedEnemyRealmStages[config.allowedEnemyRealmStages.length - 1] ??
    '初期'
  );
}

export function getDungeonRewardBonus(
  tier: DungeonDifficultyTier | undefined,
): number {
  const difficultyTier =
    tier && tier in DUNGEON_DIFFICULTY_PRESETS ? tier : 'easy';
  return DUNGEON_DIFFICULTY_PRESETS[difficultyTier].rewardBonus;
}
