import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  auctionListings,
  battleReplayArchives,
  battleRecordsV3,
  betBattles,
  dungeonHistories,
  dungeonRuns,
  mails,
  qiLogs,
  reputationShopPurchases,
  sectShopPurchases,
  sectStipendClaims,
} from '@server/lib/drizzle/schema';
import { and, inArray, lt, ne, sql } from 'drizzle-orm';

export type ExpiredDataCleanupCutoffs = {
  mails: Date;
  qiLogs: Date;
  dungeonHistories: Date;
  dungeonRuns: Date;
  battleReplayArchives: Date;
  battleRecordsV3: Date;
  betBattles: Date;
  reputationShopPurchases: Date;
  sectShopPurchases: Date;
  sectStipendClaims: Date;
  auctionListings: Date;
};

export type ExpiredDataCleanupResult = {
  mails: number;
  qiLogs: number;
  dungeonHistories: number;
  dungeonRuns: number;
  battleReplayArchives: number;
  battleRecordsV3: number;
  betBattles: number;
  reputationShopPurchases: number;
  sectShopPurchases: number;
  sectStipendClaims: number;
  auctionListings: number;
};

async function deleteExpiredRows(
  q: DbExecutor | DbTransaction,
  buildDelete: (
    q: DbExecutor | DbTransaction,
  ) => Promise<Array<{ id: unknown }>>,
): Promise<number> {
  const rows = await buildDelete(q);
  return rows.length;
}

export async function pruneExpiredData(
  cutoffs: ExpiredDataCleanupCutoffs,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<ExpiredDataCleanupResult> {
  const mailsDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(mails)
      .where(
        and(
          lt(mails.createdAt, cutoffs.mails),
          sql`(${mails.isClaimed} = true OR ${mails.attachments} IS NULL OR jsonb_typeof(${mails.attachments}) <> 'array' OR jsonb_array_length(${mails.attachments}) = 0)`,
        ),
      )
      .returning({ id: mails.id }),
  );

  const qiLogsDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(qiLogs)
      .where(lt(qiLogs.createdAt, cutoffs.qiLogs))
      .returning({ id: qiLogs.id }),
  );

  const dungeonHistoriesDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(dungeonHistories)
      .where(lt(dungeonHistories.createdAt, cutoffs.dungeonHistories))
      .returning({ id: dungeonHistories.id }),
  );

  const dungeonRunsDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(dungeonRuns)
      .where(lt(dungeonRuns.updatedAt, cutoffs.dungeonRuns))
      .returning({ id: dungeonRuns.id }),
  );

  const battleReplayArchivesDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(battleReplayArchives)
      .where(
        lt(
          battleReplayArchives.archivedAt,
          cutoffs.battleReplayArchives,
        ),
      )
      .returning({ id: battleReplayArchives.matchId }),
  );

  const battleRecordsV3Deleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(battleRecordsV3)
      .where(lt(battleRecordsV3.createdAt, cutoffs.battleRecordsV3))
      .returning({ id: battleRecordsV3.id }),
  );

  const betBattlesDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(betBattles)
      .where(
        and(
          inArray(betBattles.status, ['settled', 'cancelled', 'expired']),
          lt(betBattles.createdAt, cutoffs.betBattles),
        ),
      )
      .returning({ id: betBattles.id }),
  );

  const reputationShopPurchasesDeleted = await deleteExpiredRows(
    q,
    (executor) =>
      executor
        .delete(reputationShopPurchases)
        .where(
          lt(
            reputationShopPurchases.createdAt,
            cutoffs.reputationShopPurchases,
          ),
        )
        .returning({ id: reputationShopPurchases.id }),
  );

  const sectShopPurchasesDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(sectShopPurchases)
      .where(lt(sectShopPurchases.createdAt, cutoffs.sectShopPurchases))
      .returning({ id: sectShopPurchases.id }),
  );

  const sectStipendClaimsDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(sectStipendClaims)
      .where(lt(sectStipendClaims.claimedAt, cutoffs.sectStipendClaims))
      .returning({ id: sectStipendClaims.id }),
  );

  const auctionListingsDeleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(auctionListings)
      .where(
        and(
          ne(auctionListings.status, 'active'),
          inArray(auctionListings.status, ['sold', 'expired', 'cancelled']),
          lt(auctionListings.createdAt, cutoffs.auctionListings),
        ),
      )
      .returning({ id: auctionListings.id }),
  );

  return {
    mails: mailsDeleted,
    qiLogs: qiLogsDeleted,
    dungeonHistories: dungeonHistoriesDeleted,
    dungeonRuns: dungeonRunsDeleted,
    battleReplayArchives: battleReplayArchivesDeleted,
    battleRecordsV3: battleRecordsV3Deleted,
    betBattles: betBattlesDeleted,
    reputationShopPurchases: reputationShopPurchasesDeleted,
    sectShopPurchases: sectShopPurchasesDeleted,
    sectStipendClaims: sectStipendClaimsDeleted,
    auctionListings: auctionListingsDeleted,
  };
}
