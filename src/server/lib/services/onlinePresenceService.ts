import { redis } from '@server/lib/redis';
import { getPubSubInstanceId } from '@server/lib/services/pubSubEnvelope';
import type { AdminOnlineUsersSnapshot } from '@shared/contracts/adminOnlineUsers';

const ONLINE_CULTIVATORS_KEY = 'admin:online:cultivators:v1';
const ONLINE_CONNECTIONS_KEY = 'admin:online:connections:v1';
const ALL_TIME_PEAK_KEY = 'admin:online:peak:all:v1';
const DAY_PEAK_KEY_PREFIX = 'admin:online:peak:day:';
const DAY_PEAK_TTL_SECONDS = 60 * 60 * 24 * 8;
const ONLINE_CONNECTION_TTL_MS = 90_000;

const UPDATE_ONLINE_PRESENCE_SCRIPT = `
local connectionsKey = KEYS[1]
local cultivatorsKey = KEYS[2]
local todayPeakKey = KEYS[3]
local allTimePeakKey = KEYS[4]
local member = ARGV[1]
local online = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local connectionTtlMs = tonumber(ARGV[5])

redis.call("zremrangebyscore", connectionsKey, "-inf", nowMs)
if online == "1" then
  redis.call("zadd", connectionsKey, nowMs + connectionTtlMs, member)
else
  redis.call("zrem", connectionsKey, member)
end

local members = redis.call("zrange", connectionsKey, 0, -1)
local unique = {}
for _, value in ipairs(members) do
  local cultivatorId = string.match(value, "^[^:]+:(.+)$") or value
  unique[cultivatorId] = true
end

redis.call("del", cultivatorsKey)
local currentOnline = 0
for cultivatorId, _ in pairs(unique) do
  currentOnline = currentOnline + 1
  redis.call("sadd", cultivatorsKey, cultivatorId)
end

local todayPeak = tonumber(redis.call("get", todayPeakKey) or "0")
if currentOnline > todayPeak then
  redis.call("set", todayPeakKey, tostring(currentOnline), "EX", ttlSeconds)
end

local allTimePeak = tonumber(redis.call("get", allTimePeakKey) or "0")
if currentOnline > allTimePeak then
  redis.call("set", allTimePeakKey, tostring(currentOnline))
end

return currentOnline
`;

const localConnectionCounts = new Map<string, number>();
const memoryOnlineCultivators = new Set<string>();
let memoryToday = formatLocalDate(new Date());
let memoryTodayPeakOnline = 0;
let memoryAllTimePeakOnline = 0;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayPeakKey(today: string): string {
  return `${DAY_PEAK_KEY_PREFIX}${today}`;
}

function getConnectionMember(cultivatorId: string): string {
  return `${getPubSubInstanceId()}:${cultivatorId}`;
}

function parseCultivatorIdFromConnectionMember(member: string): string {
  const separatorIndex = member.indexOf(':');
  return separatorIndex >= 0 ? member.slice(separatorIndex + 1) : member;
}

function resetMemoryDailyPeakIfNeeded(today: string) {
  if (memoryToday === today) {
    return;
  }
  memoryToday = today;
  memoryTodayPeakOnline = memoryOnlineCultivators.size;
}

function updateMemoryPeaks(currentOnline: number, today: string) {
  resetMemoryDailyPeakIfNeeded(today);
  memoryTodayPeakOnline = Math.max(memoryTodayPeakOnline, currentOnline);
  memoryAllTimePeakOnline = Math.max(memoryAllTimePeakOnline, currentOnline);
}

function parseCount(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function readRedisSnapshot(today: string): Promise<AdminOnlineUsersSnapshot> {
  const nowMs = Date.now();
  await redis.zremrangebyscore(ONLINE_CONNECTIONS_KEY, '-inf', nowMs);
  const [connections, todayPeak, allTimePeak] = await Promise.all([
    redis.zrange(ONLINE_CONNECTIONS_KEY, 0, -1),
    redis.get(getTodayPeakKey(today)),
    redis.get(ALL_TIME_PEAK_KEY),
  ]);
  const currentOnline = new Set(connections.map(parseCultivatorIdFromConnectionMember))
    .size;

  return {
    source: 'redis',
    generatedAt: new Date().toISOString(),
    currentOnline,
    todayPeakOnline: Math.max(parseCount(todayPeak), currentOnline),
    allTimePeakOnline: Math.max(parseCount(allTimePeak), currentOnline),
    today,
  };
}

function readMemorySnapshot(today: string): AdminOnlineUsersSnapshot {
  const currentOnline = memoryOnlineCultivators.size;
  updateMemoryPeaks(currentOnline, today);

  return {
    source: 'memory',
    generatedAt: new Date().toISOString(),
    currentOnline,
    todayPeakOnline: memoryTodayPeakOnline,
    allTimePeakOnline: memoryAllTimePeakOnline,
    today,
  };
}

async function syncOnlineChangeToRedis(cultivatorId: string, online: boolean) {
  const today = formatLocalDate(new Date());
  await redis.eval(
    UPDATE_ONLINE_PRESENCE_SCRIPT,
    4,
    ONLINE_CONNECTIONS_KEY,
    ONLINE_CULTIVATORS_KEY,
    getTodayPeakKey(today),
    ALL_TIME_PEAK_KEY,
    getConnectionMember(cultivatorId),
    online ? '1' : '0',
    String(DAY_PEAK_TTL_SECONDS),
    String(Date.now()),
    String(ONLINE_CONNECTION_TTL_MS),
  );
}

function setMemoryOnline(cultivatorId: string, online: boolean) {
  if (online) {
    memoryOnlineCultivators.add(cultivatorId);
  } else {
    memoryOnlineCultivators.delete(cultivatorId);
  }
  updateMemoryPeaks(memoryOnlineCultivators.size, formatLocalDate(new Date()));
}

export function recordRealtimeConnectionOpen(cultivatorId: string): void {
  const next = (localConnectionCounts.get(cultivatorId) ?? 0) + 1;
  localConnectionCounts.set(cultivatorId, next);
  if (next !== 1) {
    return;
  }

  setMemoryOnline(cultivatorId, true);
  void syncOnlineChangeToRedis(cultivatorId, true).catch((error) => {
    console.warn('[online-presence] failed to record online cultivator', {
      cultivatorId,
      error,
    });
  });
}

export function recordRealtimeConnectionHeartbeat(cultivatorId: string): void {
  if (!localConnectionCounts.has(cultivatorId)) {
    return;
  }

  void syncOnlineChangeToRedis(cultivatorId, true).catch((error) => {
    console.warn('[online-presence] failed to refresh online cultivator', {
      cultivatorId,
      error,
    });
  });
}

export function recordRealtimeConnectionClose(cultivatorId: string): void {
  const current = localConnectionCounts.get(cultivatorId) ?? 0;
  if (current <= 1) {
    localConnectionCounts.delete(cultivatorId);
    setMemoryOnline(cultivatorId, false);
    void syncOnlineChangeToRedis(cultivatorId, false).catch((error) => {
      console.warn('[online-presence] failed to record offline cultivator', {
        cultivatorId,
        error,
      });
    });
    return;
  }

  localConnectionCounts.set(cultivatorId, current - 1);
}

export async function __recordRealtimeConnectionOpenForTests(
  cultivatorId: string,
): Promise<void> {
  const next = (localConnectionCounts.get(cultivatorId) ?? 0) + 1;
  localConnectionCounts.set(cultivatorId, next);
  if (next !== 1) {
    return;
  }

  setMemoryOnline(cultivatorId, true);
  await syncOnlineChangeToRedis(cultivatorId, true);
}

export async function __recordRealtimeConnectionCloseForTests(
  cultivatorId: string,
): Promise<void> {
  const current = localConnectionCounts.get(cultivatorId) ?? 0;
  if (current <= 1) {
    localConnectionCounts.delete(cultivatorId);
    setMemoryOnline(cultivatorId, false);
    await syncOnlineChangeToRedis(cultivatorId, false);
    return;
  }

  localConnectionCounts.set(cultivatorId, current - 1);
}

export async function getOnlineUsersSnapshot(): Promise<AdminOnlineUsersSnapshot> {
  const today = formatLocalDate(new Date());
  try {
    return await readRedisSnapshot(today);
  } catch (error) {
    console.warn('[online-presence] falling back to memory snapshot', { error });
    return readMemorySnapshot(today);
  }
}

export function __resetOnlinePresenceForTests(): void {
  localConnectionCounts.clear();
  memoryOnlineCultivators.clear();
  memoryToday = formatLocalDate(new Date());
  memoryTodayPeakOnline = 0;
  memoryAllTimePeakOnline = 0;
}
