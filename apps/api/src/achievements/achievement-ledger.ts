import { findAchievementDefinition } from '@daoyou/game-content/achievements';
import type { AchievementView } from '@daoyou/game-domain/achievements';
import {
  achievementCatalogue,
  eligibleAchievementIds,
} from '@daoyou/game-rules/achievements';
import { HttpException } from '@nestjs/common';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import { achievementUnlocks } from '@server/lib/drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { readAchievementFacts } from './achievement-facts.js';
import { recordAchievementMaximum } from './achievement-metrics.js';
import { backfillAchievementOutcomes } from './achievement-outcome-history.js';
export { recordAchievementMaximum } from './achievement-metrics.js';

/** Trusted business services grant registered IDs; request bodies never reach this API. */
export async function grantAchievement(
  tx: DbTransaction,
  input: {
    cultivatorId: string;
    achievementId: string;
    sourceKey: string;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  if (!findAchievementDefinition(input.achievementId))
    throw new HttpException({ error: '成就不存在' }, 400);
  if (!input.sourceKey || input.sourceKey.length > 200)
    throw new Error('成就来源标识无效');
  const rows = await tx
    .insert(achievementUnlocks)
    .values({
      cultivatorId: input.cultivatorId,
      achievementId: input.achievementId,
      sourceKey: input.sourceKey,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing({
      target: [
        achievementUnlocks.cultivatorId,
        achievementUnlocks.achievementId,
      ],
    })
    .returning({ id: achievementUnlocks.id });
  return rows.length > 0;
}

/** Caller owns its transaction and identity lock; progress and permanent unlocks commit together. */
export async function syncAchievements(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<{ unlockedIds: string[]; progressChanged: boolean }> {
  let progressChanged = await backfillAchievementOutcomes(tx, cultivatorId);
  const { facts, firstRelation } = await readAchievementFacts(tx, cultivatorId);
  for (const [metric, value] of Object.entries(facts.metrics)) {
    if (await recordAchievementMaximum(tx, cultivatorId, metric, value))
      progressChanged = true;
  }
  const unlockedIds: string[] = [];
  for (const achievementId of eligibleAchievementIds(facts)) {
    const granted = await grantAchievement(tx, {
      cultivatorId,
      achievementId,
      sourceKey:
        achievementId === 'mentorship.apprentice' && firstRelation
          ? firstRelation.id
          : 'snapshot:' + achievementId,
    });
    if (granted) unlockedIds.push(achievementId);
  }
  return { unlockedIds, progressChanged };
}

/** Read-only: public cards expose selected display fields, never ledger metadata. */
export async function readAchievementCatalogue(
  q: DbExecutor,
  cultivatorId: string,
): Promise<AchievementView[]> {
  const unlocks = await q
    .select({
      achievementId: achievementUnlocks.achievementId,
      sourceKey: achievementUnlocks.sourceKey,
      unlockedAt: achievementUnlocks.unlockedAt,
      rewardClaimedAt: achievementUnlocks.rewardClaimedAt,
      claimedReputation: achievementUnlocks.claimedReputation,
    })
    .from(achievementUnlocks)
    .where(eq(achievementUnlocks.cultivatorId, cultivatorId));
  const source = unlocks.find(
    (unlock) => unlock.achievementId === 'mentorship.apprentice',
  )?.sourceKey;
  const { facts } = await readAchievementFacts(q, cultivatorId, source);
  return achievementCatalogue(
    facts,
    unlocks.map((unlock) => ({
      achievementId: unlock.achievementId,
      unlockedAt: unlock.unlockedAt.toISOString(),
      rewardClaimedAt: unlock.rewardClaimedAt?.toISOString() ?? null,
      claimedReputation: unlock.claimedReputation,
    })),
  );
}
