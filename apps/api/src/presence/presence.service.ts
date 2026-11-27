import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { REDIS_CLIENT } from '@server/redis/redis.module.js';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

// Keep these keys compatible with running API instances and historical peaks.
const ONLINE_CONNECTIONS_KEY = 'admin:online:connections:v1';
const ALL_TIME_PEAK_KEY = 'admin:online:peak:all:v1';
const DAY_PEAK_KEY_PREFIX = 'admin:online:peak:day:';
const DAY_PEAK_TTL_SECONDS = 60 * 60 * 24 * 8;
const ONLINE_CONNECTION_TTL_MS = 90_000;
const LAST_ACTIVE_PERSIST_INTERVAL_MS = 5 * 60_000;

const UPDATE_ONLINE_PRESENCE_SCRIPT = `
local connectionsKey = KEYS[1]
local todayPeakKey = KEYS[2]
local allTimePeakKey = KEYS[3]
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
local currentOnline = 0
for _, value in ipairs(members) do
  local cultivatorId = string.match(value, "^[^:]+:(.+)$") or value
  if not unique[cultivatorId] then
    unique[cultivatorId] = true
    currentOnline = currentOnline + 1
  end
end

local todayPeak = tonumber(redis.call("get", todayPeakKey) or "0")
if currentOnline > todayPeak then
  redis.call("set", todayPeakKey, tostring(currentOnline), "EX", ttlSeconds)
end

local allTimePeak = tonumber(redis.call("get", allTimePeakKey) or "0")
if currentOnline > allTimePeak then
  redis.call("set", allTimePeakKey, tostring(currentOnline))
end
`;

interface PresenceSnapshot {
  source: 'redis' | 'memory';
  generatedAt: string;
  currentOnline: number;
  todayPeakOnline: number;
  allTimePeakOnline: number;
  today: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseCultivatorId(member: string): string {
  return member.slice(member.indexOf(':') + 1);
}

function parseCount(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Tracks game-wide presence by cultivator across authenticated connections. */
@Injectable()
export class PresenceService {
  private readonly instanceId = randomUUID();
  private readonly localConnections = new Map<string, number>();
  private readonly lastActivePersistedAt = new Map<string, number>();
  private memoryToday = formatLocalDate(new Date());
  private memoryTodayPeak = 0;
  private memoryAllTimePeak = 0;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
  ) {}

  recordConnectionOpen(cultivatorId: string): void {
    this.persistLastActive(cultivatorId, true);
    const count = (this.localConnections.get(cultivatorId) ?? 0) + 1;
    this.localConnections.set(cultivatorId, count);
    if (count === 1) {
      this.updateMemoryPeaks(formatLocalDate(new Date()));
      this.syncPresence(cultivatorId, true);
    }
  }

  recordConnectionHeartbeat(cultivatorId: string): void {
    if (!this.localConnections.has(cultivatorId)) return;
    this.persistLastActive(cultivatorId, false);
    this.syncPresence(cultivatorId, true);
  }

  recordConnectionClose(cultivatorId: string): void {
    const count = this.localConnections.get(cultivatorId);
    if (count === undefined) return;
    this.persistLastActive(cultivatorId, true);
    if (count > 1) {
      this.localConnections.set(cultivatorId, count - 1);
      return;
    }
    this.localConnections.delete(cultivatorId);
    this.lastActivePersistedAt.delete(cultivatorId);
    this.updateMemoryPeaks(formatLocalDate(new Date()));
    this.syncPresence(cultivatorId, false);
  }

  /** Returns matching IDs; on Redis failure, only this API instance is visible. */
  async getOnlineCultivatorIds(
    cultivatorIds: readonly string[],
  ): Promise<Set<string>> {
    if (cultivatorIds.length === 0) return new Set();

    let online: ReadonlySet<string> | ReadonlyMap<string, number>;
    try {
      online = await this.readOnlineCultivatorIds(Date.now());
    } catch (error) {
      console.warn('[presence] falling back to local online IDs', { error });
      online = this.localConnections;
    }
    return new Set(cultivatorIds.filter((id) => online.has(id)));
  }

  async getOnlineCultivatorsSnapshot(now = Date.now()): Promise<{
    source: PresenceSnapshot['source'];
    generatedAt: string;
    cultivatorIds: ReadonlySet<string>;
  }> {
    const generatedAt = new Date(now).toISOString();
    try {
      const cultivatorIds = await this.readOnlineCultivatorIds(now);
      return { source: 'redis', generatedAt, cultivatorIds };
    } catch (error) {
      console.warn('[presence] falling back to local online snapshot', { error });
      return {
        source: 'memory',
        generatedAt,
        cultivatorIds: new Set(this.localConnections.keys()),
      };
    }
  }

  async getSnapshot(): Promise<PresenceSnapshot> {
    const now = new Date();
    const generatedAt = now.toISOString();
    const today = formatLocalDate(now);
    try {
      const [[todayPeak, allTimePeak], online] = await Promise.all([
        this.redis.mget(`${DAY_PEAK_KEY_PREFIX}${today}`, ALL_TIME_PEAK_KEY),
        this.readOnlineCultivatorIds(now.getTime()),
      ]);
      return {
        source: 'redis',
        generatedAt,
        currentOnline: online.size,
        todayPeakOnline: Math.max(parseCount(todayPeak), online.size),
        allTimePeakOnline: Math.max(parseCount(allTimePeak), online.size),
        today,
      };
    } catch (error) {
      console.warn('[presence] falling back to local snapshot', { error });
      this.updateMemoryPeaks(today);
      return {
        source: 'memory',
        generatedAt,
        currentOnline: this.localConnections.size,
        todayPeakOnline: this.memoryTodayPeak,
        allTimePeakOnline: this.memoryAllTimePeak,
        today,
      };
    }
  }

  private async readOnlineCultivatorIds(now: number): Promise<Set<string>> {
    const connections = await this.redis.zrangebyscore(
      ONLINE_CONNECTIONS_KEY,
      `(${now}`,
      '+inf',
    );
    return new Set(connections.map(parseCultivatorId));
  }

  private updateMemoryPeaks(today: string): void {
    const currentOnline = this.localConnections.size;
    if (this.memoryToday !== today) {
      this.memoryToday = today;
      this.memoryTodayPeak = currentOnline;
    }
    this.memoryTodayPeak = Math.max(this.memoryTodayPeak, currentOnline);
    this.memoryAllTimePeak = Math.max(this.memoryAllTimePeak, currentOnline);
  }

  private syncPresence(cultivatorId: string, online: boolean): void {
    void this.writePresence(cultivatorId, online).catch((error) => {
      console.warn('[presence] failed to sync online state', {
        cultivatorId,
        online,
        error,
      });
    });
  }

  private async writePresence(
    cultivatorId: string,
    online: boolean,
  ): Promise<void> {
    const now = new Date();
    await this.redis.eval(
      UPDATE_ONLINE_PRESENCE_SCRIPT,
      3,
      ONLINE_CONNECTIONS_KEY,
      `${DAY_PEAK_KEY_PREFIX}${formatLocalDate(now)}`,
      ALL_TIME_PEAK_KEY,
      `${this.instanceId}:${cultivatorId}`,
      online ? '1' : '0',
      String(DAY_PEAK_TTL_SECONDS),
      String(now.getTime()),
      String(ONLINE_CONNECTION_TTL_MS),
    );
  }

  private persistLastActive(cultivatorId: string, force: boolean): void {
    const now = Date.now();
    const lastPersisted = this.lastActivePersistedAt.get(cultivatorId) ?? 0;
    if (!force && now - lastPersisted < LAST_ACTIVE_PERSIST_INTERVAL_MS) return;

    this.lastActivePersistedAt.set(cultivatorId, now);
    void this.database
      .update(cultivators)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(cultivators.id, cultivatorId))
      .catch((error) => {
        if (this.lastActivePersistedAt.get(cultivatorId) === now) {
          this.lastActivePersistedAt.delete(cultivatorId);
        }
        console.warn('[presence] failed to persist last activity', {
          cultivatorId,
          error,
        });
      });
  }
}
