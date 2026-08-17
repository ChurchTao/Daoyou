import { publishScheduledBackgroundCommand } from '@server/lib/mq/backgroundCommandPublisher';
import type { BackgroundCommandType } from '@shared/contracts/backgroundCommands';

const AUCTION_EXPIRE_SCHEDULE = '*/2 * * * *';
const BET_BATTLE_EXPIRE_SCHEDULE = '*/2 * * * *';
// Bun.cron uses UTC for cron expressions. 16:00 UTC equals 00:00 Asia/Shanghai.
const RANK_REWARDS_SCHEDULE = '0 16 * * *';
// Market refresh: every 5 minutes to pre-generate listings before 15-min cycle ends
const MARKET_REFRESH_SCHEDULE = '*/5 * * * *';
const TOWER_ENEMY_SETS_SCHEDULE = '0 * * * *';
const RESOURCE_REPLAY_CLEANUP_SCHEDULE = '30 18 * * *';
const EXPIRED_DATA_CLEANUP_SCHEDULE = '45 18 * * *';
// 17:00 UTC equals 01:00 Asia/Shanghai.
const MATERIAL_LIBRARY_DAILY_GENERATION_SCHEDULE = '0 17 * * *';
const SPONSORSHIP_RECONCILE_SCHEDULE = '*/10 * * * *';
const SPONSORSHIP_DEEP_RECONCILE_SCHEDULE = '15 19 * * *';
const SPONSORSHIP_CLEANUP_SCHEDULE = '30 19 * * *';
const SPONSORSHIP_ADMIN_DIGEST_SCHEDULE = '0 1 * * *';

let schedulerRegistered = false;
let scheduledTasks: Bun.CronJob[] = [];

async function runScheduledJob(
  commandType: BackgroundCommandType,
): Promise<void> {
  try {
    await publishScheduledBackgroundCommand(commandType);
  } catch (error) {
    console.error(`[cron] publish ${commandType} failed`, error);
  }
}

export function registerInternalCronJobs(
  options: {
    enabled?: boolean;
  } = {},
): Bun.CronJob[] {
  const { enabled = process.env.NODE_ENV === 'production' } = options;

  if (!enabled || schedulerRegistered) {
    return scheduledTasks;
  }

  scheduledTasks = [
    Bun.cron(AUCTION_EXPIRE_SCHEDULE, () => runScheduledJob('auction.expire')),
    Bun.cron(BET_BATTLE_EXPIRE_SCHEDULE, () =>
      runScheduledJob('bet-battle.expire'),
    ),
    Bun.cron(RANK_REWARDS_SCHEDULE, () =>
      runScheduledJob('ranking.rewards.distribute'),
    ),
    Bun.cron(MARKET_REFRESH_SCHEDULE, () => runScheduledJob('market.refresh')),
    Bun.cron(TOWER_ENEMY_SETS_SCHEDULE, () =>
      runScheduledJob('tower.enemy-sets.refresh'),
    ),
    Bun.cron(RESOURCE_REPLAY_CLEANUP_SCHEDULE, () =>
      runScheduledJob('resource-replay.cleanup'),
    ),
    Bun.cron(EXPIRED_DATA_CLEANUP_SCHEDULE, () =>
      runScheduledJob('expired-data.cleanup'),
    ),
    Bun.cron(MATERIAL_LIBRARY_DAILY_GENERATION_SCHEDULE, () =>
      runScheduledJob('material-library.generate'),
    ),
    Bun.cron(SPONSORSHIP_RECONCILE_SCHEDULE, () =>
      runScheduledJob('sponsorship.reconcile'),
    ),
    Bun.cron(SPONSORSHIP_DEEP_RECONCILE_SCHEDULE, () =>
      runScheduledJob('sponsorship.deep-reconcile'),
    ),
    Bun.cron(SPONSORSHIP_CLEANUP_SCHEDULE, () =>
      runScheduledJob('sponsorship.cleanup'),
    ),
    Bun.cron(SPONSORSHIP_ADMIN_DIGEST_SCHEDULE, () =>
      runScheduledJob('sponsorship.admin-digest'),
    ),
  ];
  schedulerRegistered = true;

  console.info('[cron] registered Bun cron jobs', {
    auctionExpire: AUCTION_EXPIRE_SCHEDULE,
    betBattleExpire: BET_BATTLE_EXPIRE_SCHEDULE,
    rankRewardsUtc: RANK_REWARDS_SCHEDULE,
    rankRewardsLocal: '00:00 Asia/Shanghai',
    marketRefresh: MARKET_REFRESH_SCHEDULE,
    towerEnemySets: TOWER_ENEMY_SETS_SCHEDULE,
    resourceReplayCleanupUtc: RESOURCE_REPLAY_CLEANUP_SCHEDULE,
    expiredDataCleanupUtc: EXPIRED_DATA_CLEANUP_SCHEDULE,
    materialLibraryDailyGenerationUtc:
      MATERIAL_LIBRARY_DAILY_GENERATION_SCHEDULE,
    materialLibraryDailyGenerationLocal: '01:00 Asia/Shanghai',
    sponsorshipReconcile: SPONSORSHIP_RECONCILE_SCHEDULE,
    sponsorshipDeepReconcileUtc: SPONSORSHIP_DEEP_RECONCILE_SCHEDULE,
    sponsorshipCleanupUtc: SPONSORSHIP_CLEANUP_SCHEDULE,
    sponsorshipAdminDigestUtc: SPONSORSHIP_ADMIN_DIGEST_SCHEDULE,
  });

  return scheduledTasks;
}
