import type {
  RankingChallengeRequest,
  RankingChallengeResult,
} from '@shared/contracts/combatV6Ranking';
import type { CombatV6ReplayV1 } from '@shared/contracts/combatV6Runtime';
import type { RankingBattleInput } from '@shared/engine/combat-v6/ranking/battle';
import { redis } from './index';

export const rankingQuotaKey = (owner: string, day: string) =>
  `golden_rank:v6:quota:${owner}:${day}`;
export const rankingPendingKey = (owner: string) =>
  `golden_rank:v6:pending:${owner}`;
export const rankingRunKey = (owner: string, id: string) =>
  `golden_rank:v6:run:${owner}:${id}`;
export async function hasActiveRanking(owner: string) {
  return !!(await redis.eval(
    `
local id=redis.call('GET',KEYS[1])
if not id then return 0 end
if redis.call('EXISTS',ARGV[1]..id)==1 then return 1 end
redis.call('DEL',KEYS[1]); return 0
`,
    1,
    rankingPendingKey(owner),
    `golden_rank:v6:run:${owner}:`,
  ));
}
export interface RankingRun {
  request: RankingChallengeRequest;
  userId: string;
  owner: string;
  day: string;
  startedAt: string;
  expiresAt: number;
  affectsRanking: boolean;
  participants: CombatV6ReplayV1['participants'];
  input: RankingBattleInput;
  replay?: CombatV6ReplayV1;
  result?: RankingChallengeResult;
  failed?: boolean;
}
export async function readRankingRun(
  owner: string,
  id: string,
): Promise<RankingRun | null> {
  const raw = await redis.get(rankingRunKey(owner, id));
  return raw ? JSON.parse(raw) : null;
}
export async function reserveRanking(run: RankingRun) {
  return Number(
    await redis.eval(
      `
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
if redis.call('EXISTS',KEYS[3])==1 then return -1 end
if redis.call('HLEN',KEYS[2])>=10 then return -2 end
redis.call('HSET',KEYS[2],ARGV[1],'reserved')
redis.call('PEXPIREAT',KEYS[2],ARGV[3])
redis.call('SET',KEYS[1],ARGV[2],'PXAT',ARGV[3])
redis.call('SET',KEYS[3],ARGV[1],'PXAT',ARGV[3])
return 1`,
      3,
      rankingRunKey(run.owner, run.request.requestId),
      rankingQuotaKey(run.owner, run.day),
      rankingPendingKey(run.owner),
      run.request.requestId,
      JSON.stringify(run),
      run.expiresAt,
    ),
  );
}
export async function saveRankingReplay(run: RankingRun) {
  const ok = await redis.set(
    rankingRunKey(run.owner, run.request.requestId),
    JSON.stringify(run),
    'PXAT',
    run.expiresAt,
    'XX',
  );
  if (!ok) throw new Error('天骄榜挑战状态已过期');
}
export async function releaseFailedRanking(run: RankingRun) {
  await redis.eval(
    `
redis.call('HDEL',KEYS[2],ARGV[1])
if redis.call('GET',KEYS[3])==ARGV[1] then redis.call('DEL',KEYS[3]) end
redis.call('SET',KEYS[1],ARGV[2],'PXAT',ARGV[3])
`,
    3,
    rankingRunKey(run.owner, run.request.requestId),
    rankingQuotaKey(run.owner, run.day),
    rankingPendingKey(run.owner),
    run.request.requestId,
    JSON.stringify({ ...run, failed: true }),
    run.expiresAt,
  );
}

/** CAS protects ranking reads from concurrent insertion/removal, including realm changes. */
export const RANKING_COMPARE = `
local actual=redis.call('ZRANGE',KEYS[1],0,-1)
local expected=cjson.decode(ARGV[1])
if #actual~=#expected then return 0 end
for i,id in ipairs(actual) do if expected[i]~=id then return 0 end end
`;
export const RANKING_REPLACE = `
local next=cjson.decode(ARGV[2])
redis.call('DEL',KEYS[1])
for i,id in ipairs(next) do redis.call('ZADD',KEYS[1],i,id) end
`;
export async function finishRanking(
  run: RankingRun,
  key: string,
  expected: string[],
  next: string[],
  result: RankingChallengeResult,
) {
  const compact = { ...run, input: undefined, replay: undefined, result };
  return Number(
    await redis.eval(
      `${RANKING_COMPARE}
if redis.call('EXISTS',KEYS[2])==0 or redis.call('GET',KEYS[4])~=ARGV[3] then return -1 end
${RANKING_REPLACE}
redis.call('HSET',KEYS[3],ARGV[3],'used')
redis.call('PEXPIREAT',KEYS[3],ARGV[5])
redis.call('SET',KEYS[2],ARGV[4],'PXAT',ARGV[5])
redis.call('DEL',KEYS[4])
return 1`,
      4,
      key,
      rankingRunKey(run.owner, run.request.requestId),
      rankingQuotaKey(run.owner, run.day),
      rankingPendingKey(run.owner),
      JSON.stringify(expected),
      JSON.stringify(next),
      run.request.requestId,
      JSON.stringify(compact),
      run.expiresAt,
    ),
  );
}
