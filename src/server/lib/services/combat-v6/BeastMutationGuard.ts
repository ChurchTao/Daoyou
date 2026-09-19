import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import { redis } from '@server/lib/redis';
import { hasActiveRanking } from '@server/lib/redis/rankingChallenge';
import { hasActiveTower } from '@server/lib/tower/occupancy';
import { arenaOccupancyKey } from './CombatV6ArenaStore';
import { hasActiveBreakthroughBattle } from './CombatV6BreakthroughOccupancy';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { hasActiveSectTaskBattle } from './CombatV6SectTaskOccupancy';
import { CombatV6WildStore } from './CombatV6WildStore';

export class BeastError extends Error {
  readonly status = 409;
}
export async function beastMutationOccupied(
  cultivatorId: string,
): Promise<boolean> {
  return !!(
    (await hasActiveTower(cultivatorId)) ||
    (await hasActiveRanking(cultivatorId)) ||
    (await hasActiveDungeon(cultivatorId)) ||
    (await hasActiveSectTaskBattle(cultivatorId)) ||
    (await hasActiveBreakthroughBattle(cultivatorId)) ||
    (await new CombatV6WildStore().lock(cultivatorId)) ||
    (await redis.get(arenaOccupancyKey(cultivatorId))) ||
    (await new CombatV6RuntimeStore().currentId(cultivatorId))
  );
}
export async function assertBeastIdle(cultivatorId: string) {
  if (await beastMutationOccupied(cultivatorId))
    throw new BeastError('请先结束战斗与结算，再调整灵兽');
}
