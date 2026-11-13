import { findAchievementDefinition } from '@daoyou/game-content/achievements';
import type {
  AchievementFacts,
  AchievementView,
} from '@daoyou/game-domain/achievements';
import {
  achievementCatalogue,
  eligibleAchievementIds,
} from '@daoyou/game-rules/achievements';
import { HttpException } from '@nestjs/common';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import {
  achievementUnlocks,
  mentorshipRelations,
} from '@server/lib/drizzle/schema.js';
import { and, asc, eq, sql } from 'drizzle-orm';

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

async function mentorshipFacts(
  q: DbExecutor,
  cultivatorId: string,
  apprenticeSource?: string,
) {
  const [firstRelation] = await q
    .select({
      id: mentorshipRelations.id,
      mentorName: mentorshipRelations.mentorName,
    })
    .from(mentorshipRelations)
    .where(
      and(
        eq(mentorshipRelations.discipleOriginalCultivatorId, cultivatorId),
        apprenticeSource
          ? eq(mentorshipRelations.id, apprenticeSource)
          : undefined,
      ),
    )
    .orderBy(asc(mentorshipRelations.startedAt), asc(mentorshipRelations.id))
    .limit(1);
  const [graduates] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(mentorshipRelations)
    .where(
      and(
        eq(mentorshipRelations.mentorOriginalCultivatorId, cultivatorId),
        eq(mentorshipRelations.status, 'graduated'),
      ),
    );
  const facts: AchievementFacts = {
    metrics: {
      'mentorship.bound': firstRelation ? 1 : 0,
      'mentorship.graduated_disciples': graduates?.count ?? 0,
    },
    labels: { mentorName: firstRelation?.mentorName ?? '已注销道友' },
  };
  return { facts, firstRelation };
}

/** Caller shares its transaction and social identity lock; no resource rewards are granted. */
export async function syncMentorshipAchievements(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<void> {
  const { facts, firstRelation } = await mentorshipFacts(tx, cultivatorId);
  for (const achievementId of eligibleAchievementIds(facts)) {
    await grantAchievement(tx, {
      cultivatorId,
      achievementId,
      sourceKey:
        achievementId === 'mentorship.apprentice' && firstRelation
          ? firstRelation.id
          : `mentorship:graduates:${facts.metrics['mentorship.graduated_disciples']}`,
    });
  }
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
    })
    .from(achievementUnlocks)
    .where(eq(achievementUnlocks.cultivatorId, cultivatorId));
  const source = unlocks.find(
    (unlock) => unlock.achievementId === 'mentorship.apprentice',
  )?.sourceKey;
  const { facts } = await mentorshipFacts(q, cultivatorId, source);
  return achievementCatalogue(
    facts,
    unlocks.map((unlock) => ({
      achievementId: unlock.achievementId,
      unlockedAt: unlock.unlockedAt.toISOString(),
    })),
  );
}
