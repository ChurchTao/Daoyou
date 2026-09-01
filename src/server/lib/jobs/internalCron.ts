import { db, getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import {
  isRedisLockContention,
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock';
import { getTopRankingCultivatorIds } from '@server/lib/redis/rankings';
import { getItemLibraryDailyMaterialGenerationSettings } from '@server/lib/repositories/appSettingsRepository';
import { pruneMessageConsumptions } from '@server/lib/repositories/messageConsumptionRepository';
import {
  prunePlayerMutationRequestsOlderThan,
  pruneResourceEventsOlderThan,
} from '@server/lib/repositories/playerStateRepository';
import {
  pruneExpiredData,
  type ExpiredDataCleanupResult,
} from '@server/lib/repositories/retentionRepository';
import { prunePublishedTransactionalMessages } from '@server/lib/repositories/transactionalMessageRepository';
import { expireListings } from '@server/lib/services/AuctionService';
import { expireBetBattles } from '@server/lib/services/BetBattleService';
import type { MailAttachment } from '@server/lib/services/MailService';
import { runMarketRefreshJob } from '@server/lib/services/MarketScheduler';
import {
  generateDailyMarketMaterialLibraryEntries,
  ITEM_LIBRARY_SYSTEM_USER_ID,
} from '@server/lib/services/MaterialLibraryService';
import { sendWeeklyRankingRewardCommand } from '@server/lib/services/RankingApplicationService';
import {
  cleanupSponsorshipSensitiveData,
  reconcileAfdianOrders,
  retryPendingSponsorshipWork,
  sendSponsorshipAdminDigest,
} from '@server/lib/services/SponsorshipApplicationService';
import { getSponsorshipProvider } from '@server/lib/sponsorship/providerRegistry';
import { towerEnemySetService } from '@server/lib/tower/enemySets';
import { RANKING_REWARDS, REALM_VALUES } from '@shared/types/constants';
import { eq } from 'drizzle-orm';

const RANK_REWARD_SETTLED_PREFIX = 'golden_rank:weekly_rewards:settled:';
const LOCK_TTL_SECONDS = 15 * 60;
const TOWER_ENEMY_SETS_LOCK_TTL_SECONDS = 2 * 60 * 60;
const MATERIAL_LIBRARY_DAILY_GENERATION_LOCK_TTL_SECONDS = 2 * 60 * 60;
const SETTLED_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESOURCE_REPLAY_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const MAIL_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const QI_LOG_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const DUNGEON_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DUNGEON_RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BATTLE_REPLAY_ARCHIVE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const BATTLE_RECORD_V3_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BET_BATTLE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REPUTATION_SHOP_PURCHASE_RETENTION_MS = 21 * 24 * 60 * 60 * 1000;
const SECT_SHOP_PURCHASE_RETENTION_MS = 8 * 7 * 24 * 60 * 60 * 1000;
const SECT_STIPEND_CLAIM_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const AUCTION_LISTING_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const TRANSACTIONAL_MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MESSAGE_CONSUMPTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type CronJobResult = {
  success: true;
  processed: number;
  skipped: boolean;
  reason?: string;
};

export async function runSponsorshipReconcileJob(
  deep = false,
): Promise<CronJobResult> {
  return withJobLock(
    deep ? 'sponsorship-deep-reconcile' : 'sponsorship-reconcile',
    async () => {
      const provider = getSponsorshipProvider();
      if (!provider?.isConfigured()) {
        return {
          success: true,
          processed: 0,
          skipped: true,
          reason: 'sponsorship_provider_disabled',
        };
      }
      const result = await reconcileAfdianOrders({ pages: deep ? 50 : 2 });
      const retried = await retryPendingSponsorshipWork();
      return {
        success: true,
        processed: result.scanned + retried,
        skipped: false,
      };
    },
  );
}

export async function runSponsorshipCleanupJob(): Promise<CronJobResult> {
  return withJobLock('sponsorship-cleanup', async () => {
    const result = await cleanupSponsorshipSensitiveData();
    return {
      success: true,
      processed:
        result.snapshots +
        result.orders +
        result.claims +
        result.checkoutIntents,
      skipped: false,
    };
  });
}

export async function runSponsorshipAdminDigestJob(): Promise<CronJobResult> {
  return withJobLock('sponsorship-admin-digest', async () => ({
    success: true,
    processed: await sendSponsorshipAdminDigest(),
    skipped: false,
  }));
}

export type RankRewardsJobResult = CronJobResult & {
  settlementDate?: string;
  logs?: string[];
};

export type TowerEnemySetsJobResult = CronJobResult & {
  generated: number;
  failed: number;
  logs: string[];
};

export type ExpiredDataCleanupJobResult = CronJobResult & {
  deleted: ExpiredDataCleanupResult & {
    transactionalMessages: number;
    messageConsumptions: number;
  };
};

function getRewardByRank(rank: number): number {
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank <= 10) return RANKING_REWARDS['2-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  return RANKING_REWARDS['51-100'];
}

function buildRankingRewardAttachment(reward: number): MailAttachment[] {
  return [
    {
      type: 'reputation',
      name: '声望',
      quantity: reward,
    },
  ];
}

function buildRankingRewardMailContent(args: {
  realm: string;
  rank: number;
  reward: number;
  settlementDate: string;
}): string {
  return [
    `本周天骄榜已于 ${args.settlementDate} 结算。`,
    `道友在${args.realm}天骄榜位列第 ${args.rank} 名，可领取声望 ${args.reward}。`,
    '请查收附件，领取后声望将计入道途声名。',
  ].join('\n');
}

function getSettlementDateCN(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isSettlementMondayCN(now = new Date()): boolean {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      weekday: 'short',
    }).format(now) === 'Mon'
  );
}

async function withJobLock<T extends CronJobResult>(
  jobName: string,
  run: () => Promise<T>,
  ttlSeconds: number = LOCK_TTL_SECONDS,
): Promise<T | CronJobResult> {
  const startedAt = Date.now();

  console.info(`[cron] ${jobName} started`);

  try {
    return await withRedisLock(
      {
        key: redisLockKeys.cron(jobName),
        context: `cron:${jobName}`,
        timeoutMs: ttlSeconds * 1000,
        retries: 0,
      },
      async (lease) => {
        try {
          const result = await run();
          lease.assertHeld();
          console.info(`[cron] ${jobName} finished`, {
            processed: result.processed,
            skipped: result.skipped,
            reason: result.reason,
            durationMs: Date.now() - startedAt,
          });
          return result;
        } catch (error) {
          console.error(
            `[cron] ${jobName} failed after ${Date.now() - startedAt}ms`,
            error,
          );
          throw error;
        }
      },
    );
  } catch (error) {
    if (!isRedisLockContention(error)) {
      throw error;
    }
    const result: CronJobResult = {
      success: true,
      processed: 0,
      skipped: true,
      reason: 'job_in_progress',
    };
    console.info(`[cron] ${jobName} skipped`, {
      reason: result.reason,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }
}

export async function runAuctionExpireJob(): Promise<CronJobResult> {
  return withJobLock('auction-expire', async () => {
    const processed = await expireListings();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runBetBattleExpireJob(): Promise<CronJobResult> {
  return withJobLock('bet-battle-expire', async () => {
    const processed = await expireBetBattles();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runRankRewardsJob(
  scheduledAt = new Date(),
): Promise<RankRewardsJobResult> {
  return withJobLock('rank-rewards', async () => {
    const settlementDate = getSettlementDateCN(scheduledAt);
    if (!isSettlementMondayCN(scheduledAt)) {
      return {
        success: true,
        processed: 0,
        skipped: true,
        reason: 'not_settlement_day',
        settlementDate,
      };
    }

    const settledKey = `${RANK_REWARD_SETTLED_PREFIX}${settlementDate}`;
    const alreadySettled = await redis.exists(settledKey);
    if (alreadySettled > 0) {
      return {
        success: true,
        processed: 0,
        skipped: true,
        reason: 'already_settled_today',
        settlementDate,
      };
    }

    const logs: string[] = [];
    let processed = 0;

    for (const realm of REALM_VALUES) {
      const topCultivatorIds = await getTopRankingCultivatorIds(realm, 100);
      processed += topCultivatorIds.length;

      for (let index = 0; index < topCultivatorIds.length; index += 1) {
        const cultivatorId = topCultivatorIds[index]!;
        const rank = index + 1;
        const reward = getRewardByRank(rank);
        const [cultivator] = await getExecutor()
          .select({ userId: cultivators.userId })
          .from(cultivators)
          .where(eq(cultivators.id, cultivatorId))
          .limit(1);

        if (!cultivator) {
          logs.push(`${realm} Rank ${rank}: skipped missing cultivator`);
          continue;
        }

        const committed = await sendWeeklyRankingRewardCommand({
          userId: cultivator.userId,
          cultivatorId,
          requestKey: `rank-reward:${settlementDate}:${realm}`,
          requestFingerprint: `${settlementDate}:${realm}:${cultivatorId}`,
          title: '天骄榜每周声望奖励',
          content: buildRankingRewardMailContent({
            realm,
            rank,
            reward,
            settlementDate,
          }),
          attachments: buildRankingRewardAttachment(reward),
        });

        logs.push(
          committed.state.replayed
            ? `${realm} Rank ${rank}: already mailed +${reward} reputation`
            : `${realm} Rank ${rank}: mailed +${reward} reputation`,
        );
      }
    }

    await redis.set(
      settledKey,
      Date.now().toString(),
      'EX',
      SETTLED_TTL_SECONDS,
    );

    return {
      success: true,
      settlementDate,
      processed,
      skipped: false,
      logs,
    };
  });
}

export async function runMarketRefreshCronJob(): Promise<CronJobResult> {
  return withJobLock('market-refresh', async () => {
    const result = await runMarketRefreshJob();
    return {
      success: true,
      processed: result.processed,
      skipped: result.skipped,
    };
  });
}

export async function runMaterialLibraryDailyGenerationJob(
  scheduledAt = new Date(),
): Promise<CronJobResult> {
  return withJobLock(
    'material-library-daily-generation',
    async () => {
      const settings = await getItemLibraryDailyMaterialGenerationSettings();
      if (!settings.enabled) {
        return {
          success: true,
          processed: 0,
          skipped: true,
          reason: 'disabled',
        };
      }

      const items = await generateDailyMarketMaterialLibraryEntries({
        count: settings.count,
        userId: ITEM_LIBRARY_SYSTEM_USER_ID,
        source: 'daily_cron',
        seed: `daily_cron:${getSettlementDateCN(scheduledAt)}`,
      });

      return {
        success: true,
        processed: items.length,
        skipped: false,
      };
    },
    MATERIAL_LIBRARY_DAILY_GENERATION_LOCK_TTL_SECONDS,
  );
}

export async function runTowerEnemySetRefreshJob(): Promise<
  TowerEnemySetsJobResult | CronJobResult
> {
  return withJobLock(
    'tower-enemy-sets',
    async () => {
      const results =
        await towerEnemySetService.refreshCurrentAndNextIfNeeded();
      const generated = results.reduce(
        (sum, result) => sum + result.generated,
        0,
      );
      const failed = results.reduce((sum, result) => sum + result.failed, 0);
      const skipped = results.reduce((sum, result) => sum + result.skipped, 0);
      const processed = results.reduce(
        (sum, result) => sum + result.processed,
        0,
      );

      return {
        success: true,
        processed,
        skipped: generated === 0 && failed === 0,
        generated,
        failed,
        logs: results.flatMap((result) => [
          `season ${result.seasonKey}`,
          ...result.logs,
        ]),
        reason:
          generated === 0 && failed === 0 ? `existing:${skipped}` : undefined,
      };
    },
    TOWER_ENEMY_SETS_LOCK_TTL_SECONDS,
  );
}

export async function runResourceReplayCleanupJob(): Promise<CronJobResult> {
  return withJobLock('resource-replay-cleanup', async () => {
    const cutoff = new Date(Date.now() - RESOURCE_REPLAY_RETENTION_MS);
    const [requests, events] = await db.transaction(async (tx) => [
      await prunePlayerMutationRequestsOlderThan(cutoff, tx),
      await pruneResourceEventsOlderThan(cutoff, tx),
    ]);
    return {
      success: true,
      processed: events + requests,
      skipped: false,
    };
  });
}

export async function runExpiredDataCleanupJob(): Promise<
  ExpiredDataCleanupJobResult | CronJobResult
> {
  return withJobLock('expired-data-cleanup', async () => {
    const now = Date.now();
    const deleted = await db.transaction(async (tx) => ({
      ...(await pruneExpiredData(
        {
          mails: new Date(now - MAIL_RETENTION_MS),
          qiLogs: new Date(now - QI_LOG_RETENTION_MS),
          dungeonHistories: new Date(now - DUNGEON_HISTORY_RETENTION_MS),
          dungeonRuns: new Date(now - DUNGEON_RUN_RETENTION_MS),
          battleReplayArchives: new Date(
            now - BATTLE_REPLAY_ARCHIVE_RETENTION_MS,
          ),
          battleRecordsV3: new Date(now - BATTLE_RECORD_V3_RETENTION_MS),
          betBattles: new Date(now - BET_BATTLE_RETENTION_MS),
          reputationShopPurchases: new Date(
            now - REPUTATION_SHOP_PURCHASE_RETENTION_MS,
          ),
          sectShopPurchases: new Date(now - SECT_SHOP_PURCHASE_RETENTION_MS),
          sectStipendClaims: new Date(now - SECT_STIPEND_CLAIM_RETENTION_MS),
          auctionListings: new Date(now - AUCTION_LISTING_RETENTION_MS),
        },
        tx,
      )),
      transactionalMessages: await prunePublishedTransactionalMessages(
        new Date(now - TRANSACTIONAL_MESSAGE_RETENTION_MS),
        tx,
      ),
      messageConsumptions: await pruneMessageConsumptions(
        new Date(now - MESSAGE_CONSUMPTION_RETENTION_MS),
        tx,
      ),
    }));
    const processed = Object.values(deleted).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      success: true,
      processed,
      skipped: false,
      deleted,
    };
  });
}
