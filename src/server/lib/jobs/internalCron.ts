import { randomUUID } from 'node:crypto';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { getTopRankingCultivatorIds } from '@server/lib/redis/rankings';
import { prunePlayerStateEventsOlderThan } from '@server/lib/repositories/playerStateRepository';
import { expireListings } from '@server/lib/services/AuctionService';
import { expireBetBattles } from '@server/lib/services/BetBattleService';
import { runMarketRefreshJob } from '@server/lib/services/MarketScheduler';
import { commitPlayerStateMutation } from '@server/lib/services/PlayerStateMutationService';
import { updateReputation } from '@server/lib/services/cultivatorService';
import { towerEnemySetService } from '@server/lib/tower/enemySets';
import { RANKING_REWARDS } from '@shared/types/constants';
import { eq } from 'drizzle-orm';

const AUCTION_EXPIRE_LOCK_KEY = 'cron:auction-expire:lock';
const BET_BATTLE_EXPIRE_LOCK_KEY = 'cron:bet-battle-expire:lock';
const RANK_REWARD_LOCK_KEY = 'golden_rank:rewards:lock';
const TOWER_ENEMY_SETS_LOCK_KEY = 'cron:tower-enemy-sets:lock';
const PLAYER_STATE_EVENTS_CLEANUP_LOCK_KEY =
  'cron:player-state-events-cleanup:lock';
const RANK_REWARD_SETTLED_PREFIX = 'golden_rank:weekly_rewards:settled:';
const LOCK_TTL_SECONDS = 15 * 60;
const TOWER_ENEMY_SETS_LOCK_TTL_SECONDS = 2 * 60 * 60;
const SETTLED_TTL_SECONDS = 7 * 24 * 60 * 60;
const PLAYER_STATE_EVENT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export type CronJobResult = {
  success: true;
  processed: number;
  skipped: boolean;
  reason?: string;
};

export type RankRewardsJobResult = CronJobResult & {
  settlementDate?: string;
  logs?: string[];
};

export type TowerEnemySetsJobResult = CronJobResult & {
  generated: number;
  failed: number;
  logs: string[];
};

function getRewardByRank(rank: number): number {
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank <= 10) return RANKING_REWARDS['2-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  return RANKING_REWARDS['51-100'];
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

async function releaseJobLock(lockKey: string, lockToken: string): Promise<void> {
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    lockKey,
    lockToken,
  );
}

async function withJobLock<T extends CronJobResult>(
  jobName: string,
  lockKey: string,
  run: () => Promise<T>,
  ttlSeconds: number = LOCK_TTL_SECONDS,
): Promise<T | CronJobResult> {
  const startedAt = Date.now();
  const lockToken = randomUUID();

  console.info(`[cron] ${jobName} started`);

  const lockResult = await redis.set(
    lockKey,
    lockToken,
    'EX',
    ttlSeconds,
    'NX',
  );

  if (lockResult !== 'OK') {
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

  try {
    const result = await run();
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
  } finally {
    await releaseJobLock(lockKey, lockToken);
  }
}

export async function runAuctionExpireJob(): Promise<CronJobResult> {
  return withJobLock('auction-expire', AUCTION_EXPIRE_LOCK_KEY, async () => {
    const processed = await expireListings();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runBetBattleExpireJob(): Promise<CronJobResult> {
  return withJobLock('bet-battle-expire', BET_BATTLE_EXPIRE_LOCK_KEY, async () => {
    const processed = await expireBetBattles();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runRankRewardsJob(): Promise<RankRewardsJobResult> {
  return withJobLock('rank-rewards', RANK_REWARD_LOCK_KEY, async () => {
    const now = new Date();
    const settlementDate = getSettlementDateCN(now);
    if (!isSettlementMondayCN(now)) {
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

    const topCultivatorIds = await getTopRankingCultivatorIds(100);
    const logs: string[] = [];

    for (let i = 0; i < topCultivatorIds.length; i++) {
      const rank = i + 1;
      const reward = getRewardByRank(rank);

      const [cultivator] = await getExecutor()
        .select({ userId: cultivators.userId })
        .from(cultivators)
        .where(eq(cultivators.id, topCultivatorIds[i]))
        .limit(1);

      if (!cultivator) {
        logs.push(`Rank ${rank}: skipped missing cultivator`);
        continue;
      }

      await commitPlayerStateMutation({
        userId: cultivator.userId,
        cultivatorId: topCultivatorIds[i],
        source: 'rank_weekly_rewards',
        run: async (tx) => {
          const reputation = await updateReputation(
            cultivator.userId,
            topCultivatorIds[i],
            reward,
            tx,
          );
          return {
            result: null,
            changes: [
              {
                domain: 'currency',
                eventType: 'currency.reputation.gained',
                patch: { currency: { reputation } },
                invalidates: ['currency'],
              },
            ],
          };
        },
      });

      logs.push(`Rank ${rank}: +${reward} reputation`);
    }

    await redis.set(settledKey, Date.now().toString(), 'EX', SETTLED_TTL_SECONDS);

    return {
      success: true,
      settlementDate,
      processed: topCultivatorIds.length,
      skipped: false,
      logs,
    };
  });
}

export async function runMarketRefreshCronJob(): Promise<CronJobResult> {
  return withJobLock('market-refresh', 'cron:market-refresh:lock', async () => {
    const result = await runMarketRefreshJob();
    return {
      success: true,
      processed: result.processed,
      skipped: result.skipped,
    };
  });
}

export async function runTowerEnemySetRefreshJob(): Promise<TowerEnemySetsJobResult | CronJobResult> {
  return withJobLock(
    'tower-enemy-sets',
    TOWER_ENEMY_SETS_LOCK_KEY,
    async () => {
      const results = await towerEnemySetService.refreshCurrentAndNextIfNeeded();
      const generated = results.reduce((sum, result) => sum + result.generated, 0);
      const failed = results.reduce((sum, result) => sum + result.failed, 0);
      const skipped = results.reduce((sum, result) => sum + result.skipped, 0);
      const processed = results.reduce((sum, result) => sum + result.processed, 0);

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
        reason: generated === 0 && failed === 0 ? `existing:${skipped}` : undefined,
      };
    },
    TOWER_ENEMY_SETS_LOCK_TTL_SECONDS,
  );
}

export async function runPlayerStateEventsCleanupJob(): Promise<CronJobResult> {
  return withJobLock(
    'player-state-events-cleanup',
    PLAYER_STATE_EVENTS_CLEANUP_LOCK_KEY,
    async () => {
      const cutoff = new Date(Date.now() - PLAYER_STATE_EVENT_RETENTION_MS);
      const processed = await prunePlayerStateEventsOlderThan(cutoff);
      return {
        success: true,
        processed,
        skipped: false,
      };
    },
  );
}
