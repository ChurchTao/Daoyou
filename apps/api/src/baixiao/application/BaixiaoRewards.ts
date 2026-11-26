import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { BaixiaoResources } from '@daoyou/game-domain/baixiao/meet';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import {
  baixiaoManualQuality,
  baixiaoRewardsEarned,
  planBaixiaoClearRewards,
} from '@daoyou/game-rules/baixiao/meet';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { RewardFactory } from '@server/dungeon/application/flow/reward/RewardFactory.js';
import { resolvePlanItems } from '@server/dungeon/application/flow/rewards.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { Entry, Round } from './baixiao-view.js';

export async function grantBaixiaoResources(
  tx: DbTransaction,
  actor: ActiveCultivatorRef,
  { budget, earned }: Pick<Entry, 'budget' | 'earned'>,
  beforeCorrect: number,
  afterCorrect: number,
  completion?: Pick<BaixiaoResources, 'spiritStones' | 'insight'>,
) {
  const before = baixiaoRewardsEarned(budget, beforeCorrect);
  const after = baixiaoRewardsEarned(budget, afterCorrect);
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
    completion?.spiritStones ?? 0,
    tx,
  );
  const progress = await updateCultivationExp(
    actor.userId,
    actor.cultivatorId,
    after.cultivationExp - before.cultivationExp,
    completion?.insight ?? 0,
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

export async function prepareBaixiaoClearReward(
  tx: DbTransaction,
  round: Round,
  realm: RealmType,
  correct: number,
) {
  const quality = baixiaoManualQuality(realm, randomInt(100));
  const pool = round.materials.filter((item) => {
    const facts = MaterialFactsSchema.safeParse(item.instanceData);
    return (
      item.definitionId === 'material.v1' &&
      facts.success &&
      facts.data.type === 'gongfa_manual' &&
      facts.data.rank === quality
    );
  });
  if (!pool.length) throw new Error(`本期百晓缺少${quality}功法典籍`);
  const planned = planBaixiaoClearRewards(realm, correct, randomInt(2 ** 32));
  const items = [pool[randomInt(pool.length)]];
  for (const plan of planned.plans) {
    items.push(...(await resolvePlanItems(plan, tx)));
  }
  return {
    reward: { grade: planned.grade, items },
    spiritStones: planned.spiritStones,
    insight: RewardFactory.rollExorcismInsight(
      realm,
      planned.insight,
      10,
      planned.difficultyTier,
    ),
  };
}
