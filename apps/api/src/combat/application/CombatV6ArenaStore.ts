import { redis } from '@server/lib/redis/index.js';
import {
  ARENA_V6_PROTOCOL,
  type ArenaRuntime,
  type ArenaSessionView,
} from '@daoyou/contracts/combat/arena';
import type { HuntBattleReward } from '@daoyou/contracts/hunts';

const root = 'combat:v6:arena';
export const arenaRuntimeKey = (id: string) => `${root}:runtime:${id}`;
const arenaResultKey = (id: string) => `${root}:result:${id}`;
export const arenaOccupancyKey = (id: string) => `${root}:occupancy:${id}`;
export const arenaDueKey = `${root}:due`;
const ARENA_RESULT_GRACE_MS = 120_000;
const sourceKey = (roomId: string, requestId: string) =>
  `${root}:source:${roomId}:${requestId}`;
const CREATE = `
local existing = redis.call('GET', KEYS[2])
if existing then return existing end
local runtime = cjson.decode(ARGV[1])
if runtime.hunt or runtime.invasion then
 local time = redis.call('TIME')
 local now = tonumber(time[1])*1000 + math.floor(tonumber(time[2])/1000)
 if runtime.hunt and (now >= runtime.hunt.expiresAt or now < runtime.hunt.startsAt) then return 'EXPIRED' end
 if runtime.invasion and now >= runtime.invasion.endsAt then return 'EXPIRED' end
end
for i=4,#KEYS,3 do
 if redis.call('EXISTS', KEYS[i], KEYS[i+1], KEYS[i+2]) > 0 then return 'BUSY' end
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2], 'EX', 172800)
redis.call('ZADD', KEYS[3], ARGV[3], ARGV[2])
for i=4,#KEYS,3 do redis.call('SET', KEYS[i], ARGV[2]); redis.call('SET', KEYS[i+2], ARGV[2]) end
return ARGV[2]
`;
const SAVE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.revision ~= tonumber(ARGV[1]) then return 0 end
if ARGV[5] == '1' then
 local time = redis.call('TIME')
 local now = tonumber(time[1])*1000 + math.floor(tonumber(time[2])/1000)
 if current.stage ~= 'collecting' or now >= current.deadlineAt or now >= current.expiresAt then return 0 end
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[4])
return 1
`;

const FINISH_PVE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.revision ~= tonumber(ARGV[1]) or current.stage ~= 'finished' then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PXAT', ARGV[3])
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[3], ARGV[4])
return 1
`;

type ArenaResult = Pick<ArenaRuntime, 'battleId' | 'revision' | 'participants' | 'lastResults'> & {
  participantRewards?: Record<string, HuntBattleReward>;
};
export type ArenaViewSource = ArenaRuntime | ArenaResult;

export class CombatV6ArenaStore {
  async get(id: string): Promise<ArenaRuntime | null> {
    const raw = await redis.get(arenaRuntimeKey(id));
    if (!raw) return null;
    const value = JSON.parse(raw) as ArenaRuntime;
    if (value.protocol !== ARENA_V6_PROTOCOL || value.battleId !== id)
      throw new Error('ARENA_RUNTIME_INVALID');
    return value;
  }
  async getForViewing(id: string): Promise<ArenaViewSource | null> {
    const runtime = await this.get(id);
    if (runtime) return runtime;
    const raw = await redis.get(arenaResultKey(id));
    if (!raw) return null;
    const value = JSON.parse(raw) as ArenaResult;
    if (value.battleId !== id) throw new Error('ARENA_RESULT_INVALID');
    return value;
  }
  async source(roomId: string, requestId: string) {
    return redis.get(sourceKey(roomId, requestId));
  }
  async create(runtime: ArenaRuntime) {
    const keys = runtime.participants.flatMap((p) => [
      `combat:v6:active:${p.cultivatorId}`,
      `combat:v6:wild:lock:${p.cultivatorId}`,
      arenaOccupancyKey(p.cultivatorId),
    ]);
    return redis.eval(
      CREATE,
      3 + keys.length,
      arenaRuntimeKey(runtime.battleId),
      sourceKey(runtime.roomId, runtime.startRequestId),
      arenaDueKey,
      ...keys,
      JSON.stringify(runtime),
      runtime.battleId,
      runtime.deadlineAt,
    ) as Promise<string>;
  }
  async save(next: ArenaRuntime, revision: number, submitting = false) {
    return (
      Number(
        await redis.eval(
          SAVE,
          2,
          arenaRuntimeKey(next.battleId),
          arenaDueKey,
          revision,
          JSON.stringify(next),
          Math.min(next.deadlineAt, next.expiresAt),
          next.battleId,
          submitting ? '1' : '0',
        ),
      ) === 1
    );
  }
  async online(id: string, now: number) {
    const key = `${root}:presence:${id}`;
    await redis.zremrangebyscore(key, '-inf', now - 60000);
    return (await redis.zcard(key)) > 0;
  }
  async touch(id: string, connection: string) {
    const key = `${root}:presence:${id}`;
    await redis
      .multi()
      .zadd(key, Date.now(), connection)
      .expire(key, 90)
      .exec();
  }
  async disconnect(id: string, connection: string) {
    await redis.zrem(`${root}:presence:${id}`, connection);
  }
  async release(runtime: ArenaRuntime) {
    for (const p of runtime.participants) {
      for (const key of [
        `combat:v6:active:${p.cultivatorId}`,
        arenaOccupancyKey(p.cultivatorId),
      ]) {
        await redis.eval(
          "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]) end",
          1,
          key,
          runtime.battleId,
        );
      }
    }
  }
  async acknowledge(runtime: ArenaRuntime) {
    await redis
      .multi()
      .zrem(arenaDueKey, runtime.battleId)
      .expire(arenaRuntimeKey(runtime.battleId), 86400)
      .exec();
  }
  async finishPve(
    runtime: ArenaRuntime,
    lastResults: Record<string, ArenaSessionView>,
    participantRewards?: ArenaResult['participantRewards'],
  ) {
    const result: ArenaResult = {
      battleId: runtime.battleId,
      revision: runtime.revision,
      participants: runtime.participants,
      lastResults,
      participantRewards,
    };
    await redis.eval(
      FINISH_PVE,
      3,
      arenaRuntimeKey(runtime.battleId),
      arenaResultKey(runtime.battleId),
      arenaDueKey,
      runtime.revision,
      JSON.stringify(result),
      Math.max(Date.now(), runtime.playbackEndsAt) + ARENA_RESULT_GRACE_MS,
      runtime.battleId,
    );
  }
}
