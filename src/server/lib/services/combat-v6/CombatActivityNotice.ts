import { db } from '@server/lib/drizzle/db';
import { dungeonRuns } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { activeBreakthroughBattle } from '@server/lib/services/combat-v6/CombatV6BreakthroughOccupancy';
import { arenaOccupancyKey } from '@server/lib/services/combat-v6/CombatV6ArenaStore';
import { CombatV6RuntimeStore } from '@server/lib/services/combat-v6/CombatV6RuntimeStore';
import { activeSectTaskBattle } from '@server/lib/services/combat-v6/CombatV6SectTaskOccupancy';
import { CombatV6WildStore } from '@server/lib/services/combat-v6/CombatV6WildStore';
import { pendingRanking } from '@server/lib/services/combat-v6/CombatV6RankingService';
import { towerRunKey } from '@server/lib/tower/occupancy';
import type { CombatActivityNotice } from '@shared/contracts/combatActivity';
import { shouldExpireTowerRun } from '@shared/lib/tower/lifecycle';
import { and, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';

const runtime = new CombatV6RuntimeStore();
const wild = new CombatV6WildStore();

function notice(
  kind: CombatActivityNotice['kind'],
  title: string,
  ended: boolean,
  href: string,
): CombatActivityNotice {
  return { kind, title, action: ended ? '前往结算' : '回到战斗', href };
}

function phaseEnded(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const state = (value as { state?: { phase?: string; result?: unknown } })
    .state;
  return state?.phase === 'ended' || state?.result != null;
}

async function towerNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const key = towerRunKey(owner);
  const run = parseRedisJson<{
    battleId?: string;
    season: { seasonEndsAt: string };
    battle?: { settled: boolean; snapshot: { state: { phase: string } } };
  }>(await redis.get(key), key);
  if (!run?.battleId || !run.battle || run.battle.settled) return null;
  if (
    shouldExpireTowerRun(
      {
        status: 'WAITING_BATTLE',
        season: run.season,
        battleId: run.battleId,
        battle: run.battle,
      },
      Date.now(),
    )
  )
    return null;
  return notice(
    'tower',
    '蜃楼幻境',
    phaseEnded(run.battle.snapshot),
    '/game/tower/battle',
  );
}

async function dungeonNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const [run] = await db
    .select({
      status: dungeonRuns.status,
      activeBattleId: dungeonRuns.activeBattleId,
    })
    .from(dungeonRuns)
    .where(
      and(
        eq(dungeonRuns.cultivatorId, owner),
        ne(dungeonRuns.status, 'FINISHED'),
        or(
          isNotNull(dungeonRuns.activeBattleId),
          inArray(dungeonRuns.status, ['IN_BATTLE', 'SETTLING']),
        ),
      ),
    )
    .limit(1);
  if (!run) return null;
  return notice('dungeon', '云游探秘', run.status === 'SETTLING', '/game/dungeon');
}

async function sectNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const record = await activeSectTaskBattle(owner);
  const battleId = (
    record?.payload as { executorData?: { activeBattleId?: string } } | undefined
  )?.executorData?.activeBattleId;
  if (!record || !battleId) return null;
  const raw = await redis.get(`combat:v6:sect-task:${battleId}`);
  let snapshot: unknown;
  try {
    snapshot = raw
      ? (JSON.parse(raw) as { snapshot?: unknown }).snapshot
      : undefined;
  } catch {
    snapshot = undefined;
  }
  return notice(
    'sect-task',
    '宗门挑战',
    phaseEnded(snapshot),
    `/game/sect/tasks/${encodeURIComponent(record.taskId)}/battle`,
  );
}

async function breakthroughNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const record = await activeBreakthroughBattle(owner);
  const pointer = (
    record?.metadata as { breakthroughBattle?: { battleId?: string } } | undefined
  )?.breakthroughBattle;
  if (!record || !pointer?.battleId) return null;
  const raw = await redis.get(`combat:v6:breakthrough:${pointer.battleId}`);
  let snapshot: unknown;
  try {
    snapshot = raw
      ? (JSON.parse(raw) as { snapshot?: unknown }).snapshot
      : undefined;
  } catch {
    snapshot = undefined;
  }
  return notice(
    'breakthrough',
    '破境试炼',
    phaseEnded(snapshot),
    `/game/tasks/${record.id}/challenge`,
  );
}

async function rankingNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const request = await pendingRanking(owner);
  if (!request) return null;
  const params = new URLSearchParams({
    requestId: request.requestId,
    realm: request.realm,
  });
  if (request.targetId) params.set('targetId', request.targetId);
  return notice(
    'ranking',
    '天骄榜挑战',
    false,
    `/game/battle/challenge?${params.toString()}`,
  );
}

async function arenaNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const battleId = await redis.get(arenaOccupancyKey(owner));
  if (!battleId) return null;
  return notice(
    'arena',
    '擂台切磋',
    false,
    `/game/combat-v6/arena/${encodeURIComponent(battleId)}`,
  );
}

async function wildNotice(
  battleId: string,
): Promise<CombatActivityNotice | null> {
  const summary = await wild.summary(battleId).catch(() => null);
  const session = await wild.get(battleId).catch(() => null);
  const nodeId =
    session?.metadata.payload.nodeId ?? summary?.metadata.payload.nodeId;
  const href = nodeId
    ? `/game/wild?nodeId=${encodeURIComponent(nodeId)}`
    : '/game/wild';
  return notice('wild', '野外寻觅', session ? phaseEnded(session.host) : true, href);
}

/** 至多一场。层间蜃楼和秘境探索不提示。 */
export async function readCombatActivityNotice(
  owner: string,
): Promise<CombatActivityNotice | null> {
  const tower = await towerNotice(owner);
  if (tower) return tower;
  const dungeon = await dungeonNotice(owner);
  if (dungeon) return dungeon;
  const sect = await sectNotice(owner);
  if (sect) return sect;
  const breakthrough = await breakthroughNotice(owner);
  if (breakthrough) return breakthrough;
  const ranking = await rankingNotice(owner);
  if (ranking) return ranking;
  const arena = await arenaNotice(owner);
  if (arena) return arena;
  const locked = await wild.lock(owner);
  if (locked) return wildNotice(locked);
  const battleId = await runtime.currentId(owner);
  if (!battleId) return null;
  const training = await runtime.get(battleId);
  if (!training) return null;
  return notice(
    'training',
    '练功房',
    phaseEnded(training.host),
    '/game/training-room',
  );
}
