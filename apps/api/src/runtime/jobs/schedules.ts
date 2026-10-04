import type { BackgroundCommandType } from '@daoyou/contracts/background-commands';

const AUCTION_EXPIRE_SCHEDULE = '*/2 * * * *';
// Schedules use UTC. 16:00 UTC equals 00:00 Asia/Shanghai.
const RANK_REWARDS_SCHEDULE = '0 16 * * *';
// Market refresh: every 5 minutes to pre-generate listings before 15-min cycle ends
const MARKET_REFRESH_SCHEDULE = '*/5 * * * *';
const RESOURCE_REPLAY_CLEANUP_SCHEDULE = '30 18 * * *';
const EXPIRED_DATA_CLEANUP_SCHEDULE = '45 18 * * *';
// 17:00 UTC equals 01:00 Asia/Shanghai.
const MATERIAL_LIBRARY_DAILY_GENERATION_SCHEDULE = '0 17 * * *';
const SPONSORSHIP_RECONCILE_SCHEDULE = '*/10 * * * *';
const SPONSORSHIP_DEEP_RECONCILE_SCHEDULE = '15 19 * * *';
const SPONSORSHIP_CLEANUP_SCHEDULE = '30 19 * * *';
const SPONSORSHIP_ADMIN_DIGEST_SCHEDULE = '0 1 * * *';

export const BACKGROUND_SCHEDULES = [
  { type: 'auction.expire', expression: AUCTION_EXPIRE_SCHEDULE },
  { type: 'ranking.rewards.distribute', expression: RANK_REWARDS_SCHEDULE },
  { type: 'market.refresh', expression: MARKET_REFRESH_SCHEDULE },
  {
    type: 'resource-replay.cleanup',
    expression: RESOURCE_REPLAY_CLEANUP_SCHEDULE,
  },
  { type: 'expired-data.cleanup', expression: EXPIRED_DATA_CLEANUP_SCHEDULE },
  {
    type: 'material-library.generate',
    expression: MATERIAL_LIBRARY_DAILY_GENERATION_SCHEDULE,
  },
  { type: 'sponsorship.reconcile', expression: SPONSORSHIP_RECONCILE_SCHEDULE },
  {
    type: 'sponsorship.deep-reconcile',
    expression: SPONSORSHIP_DEEP_RECONCILE_SCHEDULE,
  },
  { type: 'sponsorship.cleanup', expression: SPONSORSHIP_CLEANUP_SCHEDULE },
  {
    type: 'sponsorship.admin-digest',
    expression: SPONSORSHIP_ADMIN_DIGEST_SCHEDULE,
  },
] satisfies ReadonlyArray<{ type: BackgroundCommandType; expression: string }>;
