import {
  runAuctionExpireJob,
  runBetBattleExpireJob,
  runRankRewardsJob,
} from './internalCron';

type BunCronTask = {
  ref?: () => void;
  stop?: () => void;
  unref?: () => void;
};

type BunCronRegistrar = (
  schedule: string,
  callback: () => void | Promise<void>,
) => BunCronTask;

const AUCTION_EXPIRE_SCHEDULE = '*/2 * * * *';
const BET_BATTLE_EXPIRE_SCHEDULE = '*/2 * * * *';
// Bun.cron uses UTC for cron expressions. 16:00 UTC equals 00:00 Asia/Shanghai.
const RANK_REWARDS_SCHEDULE = '0 16 * * *';

let schedulerRegistered = false;
let scheduledTasks: BunCronTask[] = [];

function getBunCronRegistrar(): BunCronRegistrar | null {
  const bunValue = (
    globalThis as typeof globalThis & {
      Bun?: {
        cron?: BunCronRegistrar;
      };
    }
  ).Bun;

  return typeof bunValue?.cron === 'function' ? bunValue.cron : null;
}

async function runScheduledJob(
  jobName: string,
  runJob: () => Promise<unknown>,
): Promise<void> {
  try {
    await runJob();
  } catch (error) {
    console.error(`[cron] scheduled ${jobName} failed`, error);
  }
}

export function registerInternalCronJobs(options: {
  bunCron?: BunCronRegistrar;
  enabled?: boolean;
} = {}): BunCronTask[] {
  const { bunCron = getBunCronRegistrar(), enabled = process.env.NODE_ENV === 'production' } =
    options;

  if (!enabled || schedulerRegistered || !bunCron) {
    return scheduledTasks;
  }

  scheduledTasks = [
    bunCron(AUCTION_EXPIRE_SCHEDULE, () =>
      runScheduledJob('auction-expire', runAuctionExpireJob),
    ),
    bunCron(BET_BATTLE_EXPIRE_SCHEDULE, () =>
      runScheduledJob('bet-battle-expire', runBetBattleExpireJob),
    ),
    bunCron(RANK_REWARDS_SCHEDULE, () =>
      runScheduledJob('rank-rewards', runRankRewardsJob),
    ),
  ];
  schedulerRegistered = true;

  console.info('[cron] registered Bun cron jobs', {
    auctionExpire: AUCTION_EXPIRE_SCHEDULE,
    betBattleExpire: BET_BATTLE_EXPIRE_SCHEDULE,
    rankRewardsUtc: RANK_REWARDS_SCHEDULE,
    rankRewardsLocal: '00:00 Asia/Shanghai',
  });

  return scheduledTasks;
}
