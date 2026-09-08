import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import { redis } from '@server/lib/redis';
import { hasActiveRanking } from '@server/lib/redis/rankingChallenge';
import { hasActiveTower } from '@server/lib/tower/occupancy';
import { arenaOccupancyKey } from './CombatV6ArenaStore';
import { CombatV6WildStore } from './CombatV6WildStore';
import { hasActiveSectTaskBattle } from './CombatV6SectTaskOccupancy';
import { hasActiveBreakthroughBattle } from './CombatV6BreakthroughOccupancy';

const sensitive =
  /^(consumable_use|inn_recovery|body_cultivation|marrow_wash|fate_reshape|active_reincarnate|profile_attribute|task_challenge|tower_battle|retreat_|ranking_challenge|product_equip|artifact_equip|sect[._-]|dungeon|spirit_field)/;
export class CombatV6MutationLockedError extends Error {
  readonly code = 'WILD_SETTLEMENT_LOCKED';
  readonly status = 409;
  constructor() {
    super('战斗或资源结算期间无法进行此操作');
  }
}
export async function assertCombatV6MutationAllowed(
  cultivatorId: string,
  source: string,
) {
  if (sensitive.test(source) && ((await hasActiveSectTaskBattle(cultivatorId)) ||
    (await hasActiveBreakthroughBattle(cultivatorId))))
    throw new CombatV6MutationLockedError();
  if (sensitive.test(source) && (await hasActiveRanking(cultivatorId)))
    throw new CombatV6MutationLockedError();
  if (sensitive.test(source) && (await hasActiveTower(cultivatorId))) {
    throw new CombatV6MutationLockedError();
  }
  if (
    !source.startsWith('dungeon') &&
    source !== 'consumable_use' &&
    sensitive.test(source) &&
    (await hasActiveDungeon(cultivatorId))
  ) {
    throw new CombatV6MutationLockedError();
  }
  if (
    sensitive.test(source) &&
    ((await new CombatV6WildStore().lock(cultivatorId)) ||
      (await redis.get(arenaOccupancyKey(cultivatorId))))
  ) {
    throw new CombatV6MutationLockedError();
  }
}
