import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { BaixiaoResources } from '@daoyou/game-domain/baixiao/meet';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import { baixiaoRewardsEarned } from '@daoyou/game-rules/baixiao/meet';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { Round } from './baixiao-view.js';

export async function grantBaixiaoAnswer(
  tx: DbTransaction,
  actor: ActiveCultivatorRef,
  budget: BaixiaoResources,
  earned: BaixiaoResources,
  correct: number,
) {
  const before = baixiaoRewardsEarned(budget, correct - 1);
  const after = baixiaoRewardsEarned(budget, correct);
  const [character] = await tx
    .select({
      stones: cultivators.spirit_stones,
      progress: cultivators.cultivation_progress,
      realm: cultivators.realm,
      stage: cultivators.realm_stage,
    })
    .from(cultivators)
    .where(eq(cultivators.id, actor.cultivatorId));
  const previous = getOrInitCultivationProgress(
    (character.progress ?? {}) as CultivationProgress,
    character.realm as RealmType,
    character.stage as RealmStage,
  );
  const spiritStones = await updateSpiritStones(
    actor.userId,
    actor.cultivatorId,
    after.spiritStones - before.spiritStones,
    tx,
  );
  const progress = await updateCultivationExp(
    actor.userId,
    actor.cultivatorId,
    after.cultivationExp - before.cultivationExp,
    after.insight - before.insight,
    tx,
  );
  const resourceChanges: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.baixiao.answered',
      operation: 'merge',
      payload: { spiritStones },
    },
    {
      resourceTopic: 'player.progress',
      eventType: 'progress.baixiao.answered',
      operation: 'replace',
      payload: progress,
    },
  ];
  return {
    resourceChanges,
    earned: {
      cultivationExp:
        earned.cultivationExp +
        progress.cultivation_exp -
        previous.cultivation_exp,
      spiritStones: earned.spiritStones + spiritStones - character.stones,
      insight:
        earned.insight +
        progress.comprehension_insight -
        previous.comprehension_insight,
    },
  };
}

export function drawBaixiaoReward(round: Round) {
  const roll = randomInt(100);
  if (roll < 90) {
    const item = round.materials[randomInt(round.materials.length)];
    const name = (item.instanceData as { name: string }).name;
    return { item, name };
  }
  const superior = roll === 99;
  const pool = superior ? round.books.superior : round.books.ordinary;
  return {
    item: { definitionId: pool[randomInt(pool.length)], quantity: 1 },
    name: superior ? '上品传承灵印' : '传承灵印',
  };
}
