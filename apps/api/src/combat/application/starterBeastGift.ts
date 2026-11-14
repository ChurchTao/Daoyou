import { BEAST_STARTER_SPECIES } from '@daoyou/game-content/beasts';
import { generateStarterBeast } from '@daoyou/game-rules/beasts/generation';
import {
  BEAST_BAG_CAPACITY,
  carriedBeastIds,
} from '@daoyou/game-rules/beasts/growth';
import { canDeployBeast } from '@daoyou/game-rules/beasts/projection';
import { recordGrowthObserved } from '@server/cultivator/application/GrowthDomainEvents.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import {
  cultivatorBeastLineups,
  cultivatorBeasts,
} from '@server/lib/drizzle/schema.js';
import {
  beastIndividualData,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { randomInt, randomUUID } from 'node:crypto';

/**
 * 把初始灵兽放进灵兽袋。每个角色只给一次；袋子满了就不给，返回 false。
 * 不开事务也不拿锁，由调用方在自己的事务里用。
 */
export async function giveStarterBeast(
  cultivatorId: string,
  speciesId: string,
  tx: DbTransaction,
): Promise<boolean> {
  if (!BEAST_STARTER_SPECIES.some((species) => species.id === speciesId))
    throw new Error('该物种不可作为初始伙伴领取');
  const roster = await readBeastRoster(cultivatorId, tx);
  if (roster.starterClaimed) return false;
  const carried = carriedBeastIds(roster.beasts, roster.lineup);
  if (carried.length >= BEAST_BAG_CAPACITY) return false;
  const beast = generateStarterBeast(
    randomUUID(),
    cultivatorId,
    speciesId,
    randomInt(0, 0x7fffffff),
  );
  await tx.insert(cultivatorBeasts).values({
    id: beast.id,
    cultivatorId,
    individual: beastIndividualData(beast),
  });
  await recordGrowthObserved(
    tx,
    { cultivatorId, discipline: 'beasts', value: beast.level },
    `starter-beast-growth:${cultivatorId}`,
  );
  const lineup = {
    carriedBeastIds: [...carried, beast.id],
    leadBeastId:
      roster.lineup.leadBeastId ??
      (canDeployBeast(beast, roster.ownerLevel) ? beast.id : undefined),
    revision: roster.lineup.revision + 1,
  };
  await tx
    .insert(cultivatorBeastLineups)
    .values({ cultivatorId, lineup, starterClaimedAt: new Date() })
    .onConflictDoUpdate({
      target: cultivatorBeastLineups.cultivatorId,
      set: { lineup, starterClaimedAt: new Date() },
    });
  return true;
}
