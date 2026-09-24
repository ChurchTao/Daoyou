import { redis } from '@server/lib/redis';
import {
  CombatV6BattleFinishedRecordV1Schema,
  parseCombatV6Runtime,
  type CombatV6BattleFinishedRecordV1,
  type CombatV6RedisRuntimeV1,
} from '@shared/contracts/combatV6Runtime';

const PREFIX = 'combat:v6';
const OUTBOX_TTL_SECONDS = 24 * 60 * 60;
const RUNTIME_GRACE_MS = 60_000;

const runtimeKey = (id: string) => `${PREFIX}:runtime:${id}`;
const activeKey = (cultivatorId: string) => `${PREFIX}:active:${cultivatorId}`;
const idemKey = (sourceType: string, key: string) => `${PREFIX}:idem:${sourceType}:${key}`;
const terminalKey = (id: string) => `${PREFIX}:outbox:terminal:${id}`;
const replayKey = (id: string) => `${PREFIX}:outbox:replay:${id}`;
export const COMBAT_V6_TERMINAL_PENDING_KEY = `${PREFIX}:outbox:terminal:pending`;
export const COMBAT_V6_REPLAY_PENDING_KEY = `${PREFIX}:outbox:replay:pending`;
export const COMBAT_V6_DEADLINES_KEY = `${PREFIX}:deadlines`;

const CREATE_SCRIPT = `
local active = redis.call('GET', KEYS[2])
if active then return {'ACTIVE', active} end
local settlement = redis.call('GET', KEYS[5])
if settlement then return {'ACTIVE', settlement} end
local idem = redis.call('GET', KEYS[3])
if idem then return {'IDEMPOTENT', idem} end
redis.call('SET', KEYS[1], ARGV[1], 'PXAT', ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'PXAT', ARGV[2])
redis.call('SET', KEYS[3], ARGV[3], 'PXAT', ARGV[2])
redis.call('ZADD', KEYS[4], ARGV[4], ARGV[3])
return {'CREATED', ARGV[3]}
`;

const CAS_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'NOT_FOUND' end
local current = cjson.decode(raw)
if current.revision ~= tonumber(ARGV[1]) then return 'CONFLICT' end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3])
if ARGV[4] ~= '' then
  redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[6])
  redis.call('SADD', KEYS[3], ARGV[5])
end
if ARGV[7] ~= '' then
  redis.call('SET', KEYS[4], ARGV[7], 'EX', ARGV[6])
  redis.call('SADD', KEYS[5], ARGV[5])
end
return 'OK'
`;

const REMOVE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'NOT_FOUND' end
local current = cjson.decode(raw)
if current.revision ~= tonumber(ARGV[1]) then return 'CONFLICT' end
if ARGV[2] ~= '' then
  redis.call('SET', KEYS[5], ARGV[2], 'EX', ARGV[4])
  redis.call('SADD', KEYS[6], ARGV[3])
end
redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) == ARGV[3] then redis.call('DEL', KEYS[2]) end
if redis.call('GET', KEYS[3]) == ARGV[3] then redis.call('DEL', KEYS[3]) end
redis.call('ZREM', KEYS[4], ARGV[3])
return 'OK'
`;

export class CombatV6RuntimeStore {
  async create(runtime: CombatV6RedisRuntimeV1): Promise<{ status: 'created' | 'active' | 'idempotent'; battleId: string }> {
    const hardExpiry = Date.parse(runtime.expiresAt);
    const result = await redis.eval(
      CREATE_SCRIPT,
      5,
      runtimeKey(runtime.battleId), activeKey(runtime.cultivatorId),
      idemKey(runtime.metadata.sourceType, runtime.metadata.idempotencyKey), COMBAT_V6_DEADLINES_KEY, `combat:v6:wild:lock:${runtime.cultivatorId}`,
      JSON.stringify(runtime), String(hardExpiry + RUNTIME_GRACE_MS), runtime.battleId, String(hardExpiry),
    ) as [string, string];
    return { status: result[0]!.toLowerCase() as 'created' | 'active' | 'idempotent', battleId: result[1]! };
  }

  async get(battleId: string): Promise<CombatV6RedisRuntimeV1 | null> {
    const raw = await redis.get(runtimeKey(battleId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value.metadata?.sourceType === 'wild-encounter' ? null : parseCombatV6Runtime(value);
  }

  async currentId(cultivatorId: string): Promise<string | null> {
    return redis.get(activeKey(cultivatorId));
  }

  async save(runtime: CombatV6RedisRuntimeV1, expectedRevision: number, terminal?: unknown, replay?: unknown): Promise<'ok' | 'conflict' | 'not-found'> {
    const result = await redis.eval(
      CAS_SCRIPT, 5,
      runtimeKey(runtime.battleId), terminalKey(runtime.battleId), COMBAT_V6_TERMINAL_PENDING_KEY,
      replayKey(runtime.battleId), COMBAT_V6_REPLAY_PENDING_KEY,
      String(expectedRevision), JSON.stringify(runtime), String(Date.parse(runtime.expiresAt) + RUNTIME_GRACE_MS),
      terminal ? JSON.stringify(terminal) : '', runtime.battleId, String(OUTBOX_TTL_SECONDS), replay ? JSON.stringify(replay) : '',
    );
    return result === 'OK' ? 'ok' : result === 'CONFLICT' ? 'conflict' : 'not-found';
  }

  async remove(runtime: CombatV6RedisRuntimeV1, expectedRevision: number, terminal?: unknown): Promise<'ok' | 'conflict' | 'not-found'> {
    const result = await redis.eval(
      REMOVE_SCRIPT, 6,
      runtimeKey(runtime.battleId), activeKey(runtime.cultivatorId),
      idemKey(runtime.metadata.sourceType, runtime.metadata.idempotencyKey), COMBAT_V6_DEADLINES_KEY,
      terminalKey(runtime.battleId), COMBAT_V6_TERMINAL_PENDING_KEY,
      String(expectedRevision), terminal ? JSON.stringify(terminal) : '', runtime.battleId, String(OUTBOX_TTL_SECONDS),
    );
    return result === 'OK' ? 'ok' : result === 'CONFLICT' ? 'conflict' : 'not-found';
  }

  async dueBattleIds(now = Date.now(), limit = 100): Promise<string[]> {
    return redis.zrangebyscore(COMBAT_V6_DEADLINES_KEY, 0, now, 'LIMIT', 0, limit);
  }

  async pending(kind: 'terminal' | 'replay', limit = 100): Promise<string[]> {
    return redis.srandmember(kind === 'terminal' ? COMBAT_V6_TERMINAL_PENDING_KEY : COMBAT_V6_REPLAY_PENDING_KEY, limit) as Promise<string[]>;
  }

  async outbox(kind: 'terminal' | 'replay', battleId: string): Promise<unknown | null> {
    const raw = await redis.get(kind === 'terminal' ? terminalKey(battleId) : replayKey(battleId));
    return raw ? JSON.parse(raw) : null;
  }

  async terminalRecord(battleId: string): Promise<CombatV6BattleFinishedRecordV1 | null> {
    const value = await this.outbox('terminal', battleId);
    if (!value) return null;
    return CombatV6BattleFinishedRecordV1Schema.parse((value as { record?: unknown }).record);
  }

  async acknowledge(kind: 'terminal' | 'replay', battleId: string): Promise<void> {
    const pending = kind === 'terminal' ? COMBAT_V6_TERMINAL_PENDING_KEY : COMBAT_V6_REPLAY_PENDING_KEY;
    const key = kind === 'terminal' ? terminalKey(battleId) : replayKey(battleId);
    await redis.multi().del(key).srem(pending, battleId).exec();
  }

  /** 发布后只移出待发集合，完整终局记录继续留在Redis供下游按ID读取。 */
  async markTerminalPublished(battleId: string): Promise<void> {
    await redis.srem(COMBAT_V6_TERMINAL_PENDING_KEY, battleId);
  }

  async markReplayPublished(battleId: string): Promise<void> {
    await redis.srem(COMBAT_V6_REPLAY_PENDING_KEY, battleId);
  }
}
