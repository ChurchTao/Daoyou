import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  auctionListings,
  battleRecordsV2,
  dungeonHistories,
  dungeonRuns,
  mails,
  qiLogs,
  reputationShopPurchases,
} from '@server/lib/drizzle/schema';
import { and, inArray, lt, ne, sql } from 'drizzle-orm';

export type ExpiredDataCleanupCutoffs = {
  mails: Date;
  qiLogs: Date;
  dungeonHistories: Date;
  dungeonRuns: Date;
  battleRecordsV2: Date;
  reputationShopPurchases: Date;
  auctionListings: Date;
};

export type ExpiredDataCleanupResult = {
  mails: number;
  qiLogs: number;
  dungeonHistories: number;
  dungeonRuns: number;
  battleRecordsV2: number;
  reputationShopPurchases: number;
  auctionListings: number;
};

async function deleteExpiredRows(
  q: DbExecutor | DbTransaction,
  buildDelete: (q: DbExecutor | DbTransaction) => Promise<Array<{ id: unknown }>>,
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

  const battleRecordsV2Deleted = await deleteExpiredRows(q, (executor) =>
    executor
      .delete(battleRecordsV2)
      .where(lt(battleRecordsV2.createdAt, cutoffs.battleRecordsV2))
      .returning({ id: battleRecordsV2.id }),
  );

  const reputationShopPurchasesDeleted = await deleteExpiredRows(q, (executor) =>
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
    battleRecordsV2: battleRecordsV2Deleted,
    reputationShopPurchases: reputationShopPurchasesDeleted,
    auctionListings: auctionListingsDeleted,
  };
}
