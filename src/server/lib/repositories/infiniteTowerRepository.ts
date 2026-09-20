import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { cultivators, infiniteTowerProgress } from '@server/lib/drizzle/schema';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import type { InfiniteTowerLeaderboardEntry } from '@shared/lib/infiniteTower';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';

export type InfiniteTowerProgressRecord =
  typeof infiniteTowerProgress.$inferSelect;

export interface InfiniteTowerRankingRewardRecipient {
  rank: number;
  cultivatorId: string;
  userId: string;
  highestFloor: number;
}

export async function getInfiniteTowerProgress(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<InfiniteTowerProgressRecord> {
  await q
    .insert(infiniteTowerProgress)
    .values({ cultivatorId })
    .onConflictDoNothing();

  const [row] = await q
    .select()
    .from(infiniteTowerProgress)
    .where(eq(infiniteTowerProgress.cultivatorId, cultivatorId))
    .limit(1);

  if (!row) throw new Error('通天塔进度初始化失败');
  return row;
}

export async function claimInfiniteTowerFloor(args: {
  userId: string;
  cultivatorId: string;
  floor: number;
  spiritStones: number;
  now: Date;
  tx: DbTransaction;
}): Promise<{
  progress: InfiniteTowerProgressRecord;
  spiritStones: number;
}> {
  await args.tx
    .insert(infiniteTowerProgress)
    .values({ cultivatorId: args.cultivatorId })
    .onConflictDoNothing();

  const [advanced] = await args.tx
    .update(infiniteTowerProgress)
    .set({
      highestFloor: args.floor,
      totalSpiritStonesEarned: sql`${infiniteTowerProgress.totalSpiritStonesEarned} + ${args.spiritStones}`,
      firstReachedAt: sql`coalesce(${infiniteTowerProgress.firstReachedAt}, ${args.now})`,
      updatedAt: args.now,
    })
    .where(
      and(
        eq(infiniteTowerProgress.cultivatorId, args.cultivatorId),
        eq(infiniteTowerProgress.highestFloor, args.floor - 1),
      ),
    )
    .returning();

  if (!advanced) {
    const current = await getInfiniteTowerProgress(args.cultivatorId, args.tx);
    if (current.highestFloor >= args.floor) {
      throw new Error('本层首通奖励已领取');
    }
    throw new Error('通天塔进度已变化，请重新挑战当前层');
  }

  const spiritStones = await updateSpiritStones(
    args.userId,
    args.cultivatorId,
    args.spiritStones,
    args.tx,
  );
  return { progress: advanced, spiritStones };
}

export async function getInfiniteTowerLeaderboard(args: {
  realm: RealmType;
  limit: number;
  selfCultivatorId: string;
  q?: DbExecutor;
}): Promise<InfiniteTowerLeaderboardEntry[]> {
  const q = args.q ?? getExecutor();
  const rows = await q
    .select({
      cultivatorId: infiniteTowerProgress.cultivatorId,
      name: cultivators.name,
      title: cultivators.title,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
      highestFloor: infiniteTowerProgress.highestFloor,
      reachedAt: infiniteTowerProgress.updatedAt,
    })
    .from(infiniteTowerProgress)
    .innerJoin(
      cultivators,
      eq(cultivators.id, infiniteTowerProgress.cultivatorId),
    )
    .where(
      and(
        eq(cultivators.status, 'active'),
        eq(cultivators.realm, args.realm),
        gt(infiniteTowerProgress.highestFloor, 0),
      ),
    )
    .orderBy(
      desc(infiniteTowerProgress.highestFloor),
      asc(infiniteTowerProgress.updatedAt),
      asc(infiniteTowerProgress.cultivatorId),
    )
    .limit(Math.max(1, Math.min(100, Math.floor(args.limit))));

  return rows.map((row, index) => ({
    rank: index + 1,
    cultivatorId: row.cultivatorId,
    name: row.name,
    title: row.title,
    realm: row.realm as RealmType,
    realmStage: row.realmStage as RealmStage,
    highestFloor: row.highestFloor,
    reachedAt: row.reachedAt.toISOString(),
    isSelf: row.cultivatorId === args.selfCultivatorId,
  }));
}

export async function getInfiniteTowerRankingRewardRecipients(
  realm: RealmType,
  limit = 100,
  q: DbExecutor = getExecutor(),
): Promise<InfiniteTowerRankingRewardRecipient[]> {
  const rows = await q
    .select({
      cultivatorId: infiniteTowerProgress.cultivatorId,
      userId: cultivators.userId,
      highestFloor: infiniteTowerProgress.highestFloor,
    })
    .from(infiniteTowerProgress)
    .innerJoin(
      cultivators,
      eq(cultivators.id, infiniteTowerProgress.cultivatorId),
    )
    .where(
      and(
        eq(cultivators.status, 'active'),
        eq(cultivators.realm, realm),
        gt(infiniteTowerProgress.highestFloor, 0),
      ),
    )
    .orderBy(
      desc(infiniteTowerProgress.highestFloor),
      asc(infiniteTowerProgress.updatedAt),
      asc(infiniteTowerProgress.cultivatorId),
    )
    .limit(Math.max(1, Math.min(100, Math.floor(limit))));

  return rows.map((row, index) => ({
    rank: index + 1,
    cultivatorId: row.cultivatorId,
    userId: row.userId,
    highestFloor: row.highestFloor,
  }));
}
