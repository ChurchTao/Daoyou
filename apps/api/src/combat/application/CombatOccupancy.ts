import { hasDungeonBattle } from '@server/dungeon/occupancy.js';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import { redis } from '@server/lib/redis/index.js';
import { hasActiveRanking } from '@server/lib/redis/rankingChallenge.js';
import { hasTowerBattle } from '@server/tower/occupancy.js';
import { arenaOccupancyKey } from '@server/combat/application/CombatV6ArenaStore.js';
import { hasActiveBreakthroughBattle } from '@server/combat/application/CombatV6BreakthroughOccupancy.js';
import { CombatV6RuntimeStore } from '@server/combat/application/CombatV6RuntimeStore.js';
import { hasActiveSectTaskBattle } from '@server/combat/application/CombatV6SectTaskOccupancy.js';
import { CombatV6WildStore } from '@server/combat/application/CombatV6WildStore.js';

/**
 * 角色同时只能有一场战斗。层间蜃楼、秘境探索和待迎战只保留进度，不占用。
 * 已分出胜负但资源还没写完的结算仍算这场战斗。
 */
export async function hasActiveCombat(
  owner: string,
  options: { executor?: DbExecutor; includeDungeon?: boolean } = {},
) {
  const includeDungeon = options.includeDungeon !== false;
  const [
    towerBattle,
    dungeonBattle,
    ranking,
    sectBattle,
    breakthroughBattle,
    wildLock,
    arena,
    runtimeId,
  ] = await Promise.all([
    hasTowerBattle(owner),
    includeDungeon
      ? hasDungeonBattle(owner, options.executor ?? db)
      : Promise.resolve(false),
    hasActiveRanking(owner),
    hasActiveSectTaskBattle(owner),
    hasActiveBreakthroughBattle(owner),
    new CombatV6WildStore().lock(owner),
    redis.get(arenaOccupancyKey(owner)),
    new CombatV6RuntimeStore().currentId(owner),
  ]);
  return !!(
    towerBattle ||
    dungeonBattle ||
    ranking ||
    sectBattle ||
    breakthroughBattle ||
    wildLock ||
    arena ||
    runtimeId
  );
}
