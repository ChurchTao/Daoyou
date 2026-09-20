import { redis } from '@server/lib/redis';
import type {
  CombatV6ReplayV1,
  CombatV6TerminalOutboxV1,
} from '@shared/contracts/combatV6Runtime';
import {
  WildRuntimeSchema,
  WildSettlementSchema,
  type WildRuntime,
  type WildSettlement,
} from '@shared/contracts/combatV6Wild';

const root = 'combat:v6';
const run = (id: string) => `${root}:runtime:${id}`;
export const wildLockKey = (id: string) => `${root}:wild:lock:${id}`;
const summary = (id: string) => `${root}:wild:summary:${id}`;
const terminal = (id: string) => `${root}:outbox:terminal:${id}`;
const pending = `${root}:wild:settlement:pending`;
const deadlines = `${root}:wild:deadlines`;
const CREATE = `
local previous=redis.call('GET',KEYS[4])
if previous then local p=cjson.decode(previous); return {'EXISTING',p.battleId} end
local active=redis.call('GET',KEYS[2]); if active then return {'EXISTING',active} end
local locked=redis.call('GET',KEYS[3]); if locked then return {'SETTLING',locked} end
redis.call('SET',KEYS[1],ARGV[1],'PXAT',ARGV[3]); redis.call('SET',KEYS[2],ARGV[2],'PXAT',ARGV[3])
redis.call('SET',KEYS[3],ARGV[2])
redis.call('SET',KEYS[4],cjson.encode({battleId=ARGV[2],nodeId=ARGV[4]}),'EX',259200)
redis.call('SET',KEYS[5],ARGV[5]); redis.call('ZADD',KEYS[6],ARGV[3],ARGV[2])
return {'CREATED',ARGV[2]}
`;
const SAVE = `
local raw=redis.call('GET',KEYS[1]); if not raw then return 'NOT_FOUND' end
local old=cjson.decode(raw); if old.revision~=tonumber(ARGV[1]) then return 'CONFLICT' end
if old.host.state.result then return 'CONFLICT' end
if redis.call('EXISTS',KEYS[3])==1 then return 'CONFLICT' end
redis.call('SET',KEYS[1],ARGV[2],'PXAT',ARGV[3]); redis.call('SET',KEYS[2],ARGV[4])
if ARGV[5]~='' then redis.call('SET',KEYS[3],ARGV[5]); redis.call('SADD',KEYS[4],ARGV[6]); redis.call('SADD',KEYS[5],ARGV[6]); redis.call('ZREM',KEYS[8],ARGV[6]) end
if ARGV[7]~='' then redis.call('SET',KEYS[6],ARGV[7],'EX',86400); redis.call('SADD',KEYS[7],ARGV[6]) end
return 'OK'
`;
const FINISH = `
local s=redis.call('GET',KEYS[1]); if not s then return 'NOT_FOUND' end
if cjson.decode(s).revision~=tonumber(ARGV[1]) then return 'CONFLICT' end
if redis.call('EXISTS',KEYS[2])==1 then return 'OK' end
redis.call('SET',KEYS[2],ARGV[2]); redis.call('SADD',KEYS[3],ARGV[3]); redis.call('SADD',KEYS[4],ARGV[3]); redis.call('ZREM',KEYS[5],ARGV[3])
redis.call('DEL',KEYS[6]); if redis.call('GET',KEYS[7])==ARGV[3] then redis.call('DEL',KEYS[7]) end
return 'OK'
`;

export class CombatV6WildStore {
  async get(id: string): Promise<WildRuntime | null> {
    const raw = await redis.get(run(id));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value.metadata?.sourceType === 'wild-encounter'
      ? (WildRuntimeSchema.parse(value) as unknown as WildRuntime)
      : null;
  }
  async request(
    cultivatorId: string,
    requestId: string,
  ): Promise<{ battleId: string; nodeId: string } | null> {
    const raw = await redis.get(
      `${root}:wild:request:${cultivatorId}:${requestId}`,
    );
    return raw ? JSON.parse(raw) : null;
  }
  async summary(id: string): Promise<WildSettlement | null> {
    const raw = await redis.get(summary(id));
    return raw
      ? (WildSettlementSchema.parse(JSON.parse(raw)) as WildSettlement)
      : null;
  }
  async lock(id: string) {
    return redis.get(wildLockKey(id));
  }
  async create(runtime: WildRuntime, s: WildSettlement, requestId: string) {
    WildRuntimeSchema.parse(runtime);
    WildSettlementSchema.parse(s);
    return redis.eval(
      CREATE,
      6,
      run(runtime.battleId),
      `${root}:active:${runtime.cultivatorId}`,
      wildLockKey(runtime.cultivatorId),
      `${root}:wild:request:${runtime.cultivatorId}:${requestId}`,
      summary(runtime.battleId),
      deadlines,
      JSON.stringify(runtime),
      runtime.battleId,
      String(Date.parse(runtime.expiresAt)),
      runtime.metadata.payload.nodeId,
      JSON.stringify(s),
    ) as Promise<[string, string]>;
  }
  async save(
    runtime: WildRuntime,
    expected: number,
    s: WildSettlement,
    event?: CombatV6TerminalOutboxV1,
    replay?: CombatV6ReplayV1,
  ) {
    WildRuntimeSchema.parse(runtime);
    WildSettlementSchema.parse(s);
    return redis.eval(
      SAVE,
      8,
      run(runtime.battleId),
      summary(runtime.battleId),
      terminal(runtime.battleId),
      `${root}:outbox:terminal:pending`,
      pending,
      `${root}:outbox:replay:${runtime.battleId}`,
      `${root}:outbox:replay:pending`,
      deadlines,
      String(expected),
      JSON.stringify(runtime),
      String(Date.parse(runtime.expiresAt)),
      JSON.stringify(s),
      event ? JSON.stringify(event) : '',
      runtime.battleId,
      replay ? JSON.stringify(replay) : '',
    ) as Promise<string>;
  }
  async finish(s: WildSettlement, event: CombatV6TerminalOutboxV1) {
    WildSettlementSchema.parse(s);
    return redis.eval(
      FINISH,
      7,
      summary(s.battleId),
      terminal(s.battleId),
      `${root}:outbox:terminal:pending`,
      pending,
      deadlines,
      run(s.battleId),
      `${root}:active:${s.cultivatorId}`,
      String(s.revision),
      JSON.stringify(event),
      s.battleId,
    ) as Promise<string>;
  }
  async clearFinished(runtime: WildRuntime, expected: number) {
    return redis.eval(
      `local raw=redis.call('GET',KEYS[1]); if not raw then return 'NOT_FOUND' end; if cjson.decode(raw).revision~=tonumber(ARGV[1]) then return 'CONFLICT' end; if redis.call('EXISTS',KEYS[3])==1 then return 'SETTLING' end; redis.call('DEL',KEYS[1]); if redis.call('GET',KEYS[2])==ARGV[2] then redis.call('DEL',KEYS[2]) end; return 'OK'`,
      3,
      run(runtime.battleId),
      `${root}:active:${runtime.cultivatorId}`,
      wildLockKey(runtime.cultivatorId),
      String(expected),
      runtime.battleId,
    ) as Promise<string>;
  }
  async due(now = Date.now()) {
    return redis.zrangebyscore(deadlines, 0, now, 'LIMIT', 0, 100);
  }
  async pending() {
    return redis.srandmember(pending, 100) as Promise<string[]>;
  }
  async complete(s: WildSettlement, now = Date.now()) {
    await redis.eval(
      `if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]) end; redis.call('DEL',KEYS[2]); redis.call('SREM',KEYS[3],ARGV[1]); if redis.call('EXISTS',KEYS[4])==1 then local t=cjson.decode(redis.call('GET',KEYS[4])); local deadline=math.max(tonumber(ARGV[2]),tonumber(ARGV[3])); redis.call('PEXPIREAT',KEYS[4],deadline) end; return 1`,
      4,
      wildLockKey(s.cultivatorId),
      summary(s.battleId),
      pending,
      terminal(s.battleId),
      s.battleId,
      String(now + 86400000),
      String(Date.parse(s.createdAt) + 86400000),
    );
  }
}
