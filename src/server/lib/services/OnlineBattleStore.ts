import { getRedisClient, redis } from '@server/lib/redis';
import {
  parseBattleReplay,
  type BattleReplayV1,
} from '@shared/contracts/battleReplay';
import {
  BattleResolutionTaskSchema,
  type BattleResolutionTaskV1,
} from '@shared/contracts/battleResolutionTask';
import {
  BattleCleanupManifestSchema,
  BattleTerminalEventSchema,
  type BattleCleanupManifestV1,
  type BattleTerminalEventV1,
  type BattleTerminalOutboxV1,
} from '@shared/contracts/battleTerminal';
import {
  ONLINE_BATTLE_ACCEPT_TIMEOUT_MS,
  ONLINE_BATTLE_RESOLUTION_FAILURE_TIMEOUT_MS,
  type OnlineBattleCommandReceiptRecordV1,
} from '@shared/contracts/onlineBattleRuntime';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import type { BattleMatchStateV1 } from '@shared/engine/battle-v5/match/types';
import type {
  BattleBlueprintV1,
  BattleSaveV1,
} from '@shared/engine/battle-v5/persistence/types';
import {
  BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES,
  battlePresentationSerializedBytes,
  type CompactBattlePresentationWindowV1,
} from '@shared/online-battle/BattlePresentation';
import { releaseArenaRoomForBattle } from './BattleArenaRoomFinalizer';
import {
  BATTLE_ONLINE_ALL_MATCHES_KEY,
  BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
  BATTLE_ONLINE_DEADLINES_KEY,
  BATTLE_ONLINE_RESOLVING_KEY,
  BATTLE_ONLINE_WAITING_CLAIMS_KEY,
  BATTLE_ONLINE_WAITING_KEY,
  BATTLE_RESOLUTION_TASK_PENDING_KEY,
  BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
  BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
  battleOnlineCommandReceiptsKey,
  battleOnlineEventSnapshotsKey,
  battleOnlineMatchKey,
  battleOnlinePresentationKey,
  battleReplayArchivePayloadKey,
  battleReplayRoundsKey,
  battleTerminalOutboxKey,
} from './BattleOnlineRedisKeys';
import {
  BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
  BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
  BATTLE_REPLAY_ARCHIVED_TTL_SECONDS,
  BATTLE_REPLAY_CONFIRM_TIMEOUT_MS,
} from './BattleReplayRedisStore';
import { observeOnlineBattleMetric } from './OnlineBattleMetrics';
import type { OnlineBattleRuntimeStateV1 } from './OnlineBattleRuntimeState';
import { assertOnlineBattleRuntimeState } from './OnlineBattleRuntimeState';

const ARENA_START_INDEX_TTL_SECONDS = 2 * 60 * 60;
const TERMINAL_OUTBOX_TTL_SECONDS = 30 * 24 * 60 * 60;
const TERMINAL_COMPLETED_TTL_SECONDS = 24 * 60 * 60;
const SCHEDULE_CLAIM_LEASE_MS = 15_000;
const ONLINE_BATTLE_EVENT_SNAPSHOT_TTL_SECONDS = 30;
const ONLINE_BATTLE_EVENT_SNAPSHOT_MAX_ENTRIES = 16;
export const RESOLUTION_TASK_REPUBLISH_LEASE_MS = 30_000;

interface StoredOnlineBattleEventSnapshotV1 {
  readonly version: 'online_battle_event_snapshot_v1';
  readonly matchId: string;
  readonly eventSeq: number;
  readonly matchRevision: number;
  readonly createdAt: number;
  readonly matchWithoutBlueprint: BattleMatchStateV1;
  readonly acceptedPlayerIds: readonly string[];
  readonly presentationWindow?: CompactBattlePresentationWindowV1;
}

export interface OnlineBattleEventSnapshotV1 {
  readonly version: 'online_battle_event_snapshot_v1';
  readonly matchId: string;
  readonly eventSeq: number;
  readonly matchRevision: number;
  readonly createdAt: number;
  readonly match: BattleMatchStateV1;
  readonly acceptedPlayerIds: readonly string[];
  readonly presentationWindow?: CompactBattlePresentationWindowV1;
}
const ONLINE_BATTLE_RESERVED_ROOT_KEYS = new Set([
  BATTLE_ONLINE_ALL_MATCHES_KEY,
  BATTLE_ONLINE_DEADLINES_KEY,
  BATTLE_ONLINE_RESOLVING_KEY,
  BATTLE_ONLINE_WAITING_KEY,
  BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
  BATTLE_ONLINE_WAITING_CLAIMS_KEY,
]);
const ONLINE_BATTLE_DERIVED_INDEX_TYPES = [
  [BATTLE_ONLINE_ALL_MATCHES_KEY, 'set'],
  [BATTLE_ONLINE_DEADLINES_KEY, 'zset'],
  [BATTLE_ONLINE_DEADLINE_CLAIMS_KEY, 'zset'],
  [BATTLE_ONLINE_RESOLVING_KEY, 'set'],
  [BATTLE_ONLINE_WAITING_KEY, 'zset'],
  [BATTLE_ONLINE_WAITING_CLAIMS_KEY, 'zset'],
  [BATTLE_RESOLUTION_TASK_PENDING_KEY, 'set'],
  [BATTLE_REPLAY_ARCHIVE_PENDING_KEY, 'set'],
  [BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, 'zset'],
  [BATTLE_TERMINAL_OUTBOX_PENDING_KEY, 'set'],
  [BATTLE_TERMINAL_CLEANUP_PENDING_KEY, 'set'],
] as const;

const CREATE_MATCH_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if ARGV[8] ~= '' and redis.call('EXISTS', KEYS[6]) == 1 then return -1 end
redis.call('HSET', KEYS[1],
  'state_id', ARGV[1],
  'state', ARGV[2],
  'initial_state', ARGV[2],
  'blueprint', ARGV[10],
  'status', ARGV[3],
  'match_revision', ARGV[14],
  'client_event_seq', ARGV[15],
  'deadline_at', ARGV[4],
  'updated_at', ARGV[5],
  'cleanup_manifest', ARGV[11],
  'participants', ARGV[12])
redis.call('SADD', KEYS[4], ARGV[6])
if ARGV[4] ~= '' then redis.call('ZADD', KEYS[2], ARGV[4], ARGV[6]) end
if ARGV[3] == 'resolving' then redis.call('SADD', KEYS[3], ARGV[6]) end
if ARGV[7] ~= '' then redis.call('ZADD', KEYS[5], ARGV[7], ARGV[6]) end
if ARGV[8] ~= '' then redis.call('SET', KEYS[6], ARGV[6], 'EX', ARGV[9]) end
redis.call('ZREM', KEYS[7], ARGV[6])
redis.call('ZREM', KEYS[8], ARGV[6])
redis.call('SREM', KEYS[9], ARGV[6])
for index = 10, #KEYS do
  redis.call('ZADD', KEYS[index], ARGV[13], ARGV[6])
end
return 1
`;

const CAS_STATE_LUA = `
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -2 end
local currentStatus = redis.call('HGET', KEYS[1], 'status')
if currentStatus == 'finished' or currentStatus == 'cancelled' then return -4 end
if tonumber(current) ~= tonumber(ARGV[1]) or tonumber(ARGV[2]) ~= tonumber(current) + 1 then
  return -1
end
if ARGV[15] ~= '' and redis.call('HEXISTS', KEYS[13], ARGV[15]) == 1 then
  return -3
end
redis.call('HSET', KEYS[1],
  'state_id', ARGV[2],
  'state', ARGV[3],
  'status', ARGV[4],
  'match_revision', ARGV[18],
  'client_event_seq', ARGV[19],
  'deadline_at', ARGV[5],
  'updated_at', ARGV[6])
redis.call('ZREM', KEYS[2], ARGV[7])
if ARGV[5] ~= '' then redis.call('ZADD', KEYS[2], ARGV[5], ARGV[7]) end
redis.call('SREM', KEYS[3], ARGV[7])
if ARGV[4] == 'resolving' then redis.call('SADD', KEYS[3], ARGV[7]) end
redis.call('ZREM', KEYS[5], ARGV[7])
if ARGV[8] ~= '' then redis.call('ZADD', KEYS[5], ARGV[8], ARGV[7]) end
redis.call('ZREM', KEYS[10], ARGV[7])
redis.call('ZREM', KEYS[11], ARGV[7])
redis.call('HDEL', KEYS[1],
  'resolution_task',
  'resolution_task_status',
  'resolution_task_published_at',
  'resolution_task_publish_attempt')
redis.call('SREM', KEYS[12], ARGV[7])
if ARGV[14] ~= '' then
  redis.call('HSET', KEYS[1],
    'resolution_task', ARGV[14],
    'resolution_task_status', 'pending',
    'resolution_task_publish_attempt', '1')
  redis.call('SADD', KEYS[12], ARGV[7])
end
if ARGV[9] ~= '' then redis.call('RPUSH', KEYS[7], ARGV[9]) end
if ARGV[10] ~= '' then
  redis.call('HSET', KEYS[14],
    'expected_storage_revision', ARGV[10],
    'archive_status', 'pending',
    'archive_publish_attempt', '0')
  redis.call('SADD', KEYS[6], ARGV[7])
end
if ARGV[11] ~= '' then
  redis.call('HSET', KEYS[9],
    'event', ARGV[11],
    'manifest', ARGV[12],
    'publish_status', 'pending',
    'created_at', ARGV[6])
  redis.call('EXPIRE', KEYS[9], ARGV[13])
  redis.call('SADD', KEYS[8], ARGV[7])
  redis.call('SREM', KEYS[4], ARGV[7])
end
if ARGV[15] ~= '' then redis.call('HSET', KEYS[13], ARGV[15], ARGV[16]) end
if ARGV[17] ~= '' then
  redis.call('HSET', KEYS[1], 'participants', ARGV[17])
  redis.call('ZREM', KEYS[15], ARGV[7])
end
if ARGV[20] ~= '' then
  redis.call('SET', KEYS[16], ARGV[20])
elseif ARGV[21] == '1' then
  redis.call('DEL', KEYS[16])
end
if ARGV[22] ~= '' then
  redis.call('HSET', KEYS[17], ARGV[22], ARGV[23])
  if ARGV[24] ~= '' then redis.call('HDEL', KEYS[17], ARGV[24]) end
  redis.call('EXPIRE', KEYS[17], ARGV[25])
end
if ARGV[11] ~= '' and redis.call('EXISTS', KEYS[13]) == 1 then
  redis.call('EXPIRE', KEYS[13], ARGV[13])
end
return 1
`;

const DISCARD_MATCH_LUA = `
if ARGV[2] ~= '' and ARGV[3] ~= '' then
  redis.call('HSET', KEYS[10],
    'event', ARGV[2],
    'manifest', ARGV[3],
    'publish_status', 'pending',
    'created_at', ARGV[4])
  redis.call('EXPIRE', KEYS[10], ARGV[5])
  redis.call('SADD', KEYS[9], ARGV[1])
end
redis.call('DEL', KEYS[1], KEYS[8], KEYS[14], KEYS[15], KEYS[16])
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('SREM', KEYS[4], ARGV[1])
redis.call('ZREM', KEYS[5], ARGV[1])
redis.call('SREM', KEYS[6], ARGV[1])
redis.call('ZREM', KEYS[7], ARGV[1])
redis.call('ZREM', KEYS[11], ARGV[1])
redis.call('ZREM', KEYS[12], ARGV[1])
redis.call('SREM', KEYS[13], ARGV[1])
return 1
`;

const CLAIM_DUE_LUA = `
local expiredClaims = redis.call('ZRANGEBYSCORE', KEYS[2], 0, ARGV[1], 'LIMIT', 0, ARGV[3])
for _, matchId in ipairs(expiredClaims) do
  redis.call('ZREM', KEYS[2], matchId)
  redis.call('ZADD', KEYS[1], 0, matchId)
end
local due = redis.call('ZRANGEBYSCORE', KEYS[1], 0, ARGV[1], 'LIMIT', 0, ARGV[3])
for _, matchId in ipairs(due) do
  redis.call('ZREM', KEYS[1], matchId)
  redis.call('ZADD', KEYS[2], ARGV[2], matchId)
end
return due
`;

const PRUNE_ACTIVE_INDEXES_LUA = `
redis.call('SREM', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('SREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[4], ARGV[1])
redis.call('ZREM', KEYS[5], ARGV[1])
redis.call('ZREM', KEYS[6], ARGV[1])
redis.call('SREM', KEYS[7], ARGV[1])
redis.call('DEL', KEYS[8], KEYS[9])
return 1
`;

const STORE_COMMAND_RECEIPT_LUA = `
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -2 end
if tonumber(current) ~= tonumber(ARGV[1]) then return -1 end
if redis.call('HSETNX', KEYS[2], ARGV[2], ARGV[3]) == 1 then return 1 end
return 0
`;

const STAGE_RESOLUTION_TASK_LUA = `
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -1 end
if tonumber(current) ~= tonumber(ARGV[1]) then return 0 end
if redis.call('HGET', KEYS[1], 'status') ~= 'resolving' then return -2 end
local existing = redis.call('HGET', KEYS[1], 'resolution_task')
if existing == ARGV[2] then
  local taskStatus = redis.call('HGET', KEYS[1], 'resolution_task_status')
  local publishedAt = tonumber(redis.call('HGET', KEYS[1], 'resolution_task_published_at') or '0')
  if taskStatus == 'published' and publishedAt > tonumber(ARGV[4]) then return 2 end
  local publishAttempt = tonumber(redis.call('HGET', KEYS[1], 'resolution_task_publish_attempt') or '1')
  redis.call('HSET', KEYS[1],
    'resolution_task_status', 'pending',
    'resolution_task_publish_attempt', tostring(publishAttempt + 1))
  redis.call('HDEL', KEYS[1], 'resolution_task_published_at')
  redis.call('SADD', KEYS[2], ARGV[3])
  redis.call('ZREM', KEYS[3], ARGV[3])
  return 3
end
redis.call('HSET', KEYS[1],
  'resolution_task', ARGV[2],
  'resolution_task_status', 'pending',
  'resolution_task_publish_attempt', '1')
redis.call('HDEL', KEYS[1], 'resolution_task_published_at')
redis.call('SADD', KEYS[2], ARGV[3])
redis.call('ZREM', KEYS[3], ARGV[3])
return 1
`;

const MARK_RESOLUTION_TASK_PUBLISHED_LUA = `
local task = redis.call('HGET', KEYS[1], 'resolution_task')
if not task then
  redis.call('SREM', KEYS[2], ARGV[1])
  return 0
end
if task ~= ARGV[2] then return -1 end
if redis.call('HGET', KEYS[1], 'resolution_task_publish_attempt') ~= ARGV[3] then return -2 end
redis.call('HSET', KEYS[1], 'resolution_task_status', 'published')
redis.call('HSET', KEYS[1], 'resolution_task_published_at', ARGV[4])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
`;

const RECONCILE_ACTIVE_INDEXES_LUA = `
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -1 end
if tonumber(current) ~= tonumber(ARGV[1]) then return 0 end
local hasResolutionTask = redis.call('HEXISTS', KEYS[1], 'resolution_task')
if (hasResolutionTask == 1 and ARGV[7] ~= '1') or
   (hasResolutionTask == 0 and ARGV[7] == '1') then return 0 end
if ARGV[2] == '1' then
  redis.call('SADD', KEYS[2], ARGV[6])
else
  redis.call('SREM', KEYS[2], ARGV[6])
end
redis.call('ZREM', KEYS[3], ARGV[6])
if ARGV[3] ~= '' then redis.call('ZADD', KEYS[3], ARGV[3], ARGV[6]) end
redis.call('SREM', KEYS[4], ARGV[6])
if ARGV[4] == '1' then redis.call('SADD', KEYS[4], ARGV[6]) end
redis.call('ZREM', KEYS[5], ARGV[6])
if ARGV[5] ~= '' then redis.call('ZADD', KEYS[5], ARGV[5], ARGV[6]) end
redis.call('ZREM', KEYS[6], ARGV[6])
redis.call('ZREM', KEYS[7], ARGV[6])
return 1
`;

const MARK_TERMINAL_OUTBOX_PUBLISHED_LUA = `
redis.call('HSET', KEYS[1],
  'publish_status', 'published',
  'published_at', ARGV[2])
redis.call('SREM', KEYS[2], ARGV[1])
if redis.call('HGET', KEYS[1], 'cleanup_status') ~= 'completed' then
  redis.call('SADD', KEYS[3], ARGV[1])
end
return 1
`;

const MARK_TERMINAL_CLEANUP_COMPLETED_LUA = `
redis.call('HSET', KEYS[1],
  'cleanup_status', 'completed',
  'completed_at', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('SREM', KEYS[3], ARGV[1])
return 1
`;

const RECONCILE_TERMINAL_OUTBOX_TRACKING_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('SREM', KEYS[2], ARGV[1])
  redis.call('SREM', KEYS[3], ARGV[1])
  return 0
end
if redis.call('HGET', KEYS[1], 'cleanup_status') == 'completed' then
  redis.call('SREM', KEYS[2], ARGV[1])
  redis.call('SREM', KEYS[3], ARGV[1])
  return 2
end
if redis.call('HGET', KEYS[1], 'publish_status') == 'published' then
  redis.call('SREM', KEYS[2], ARGV[1])
  redis.call('SADD', KEYS[3], ARGV[1])
  return 3
end
redis.call('HSET', KEYS[1], 'publish_status', 'pending')
redis.call('SADD', KEYS[2], ARGV[1])
return 1
`;

const FINALIZE_TERMINAL_INDEXES_LUA = `
redis.call('SREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[4], ARGV[1])
redis.call('SREM', KEYS[5], ARGV[1])
redis.call('ZREM', KEYS[6], ARGV[1])
redis.call('ZREM', KEYS[10], ARGV[1])
redis.call('ZREM', KEYS[11], ARGV[1])
redis.call('SREM', KEYS[12], ARGV[1])
if redis.call('GET', KEYS[9]) == ARGV[1] then redis.call('DEL', KEYS[9]) end
if ARGV[3] == 'cancelled' then
  redis.call('SREM', KEYS[7], ARGV[1])
  redis.call('ZREM', KEYS[8], ARGV[1])
end
if ARGV[3] == 'cancelled' then
  if redis.call('EXISTS', KEYS[1]) == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
  if redis.call('EXISTS', KEYS[2]) == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
end
if redis.call('EXISTS', KEYS[13]) == 1 then redis.call('EXPIRE', KEYS[13], ARGV[2]) end
for index = 14, #KEYS do redis.call('ZREM', KEYS[index], ARGV[1]) end
return 1
`;

const MARK_ARCHIVE_PUBLISHED_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if tonumber(redis.call('HGET', KEYS[1], 'expected_storage_revision') or '-1') ~= tonumber(ARGV[4]) then return 3 end
local status = redis.call('HGET', KEYS[1], 'archive_status')
local currentAttempt = tonumber(redis.call('HGET', KEYS[1], 'archive_publish_attempt') or '0')
local incomingAttempt = tonumber(ARGV[3])
if status == 'archived' then
  redis.call('SREM', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[3], ARGV[1])
  return 2
end
if status ~= 'pending' and status ~= 'published' then return -1 end
if incomingAttempt < currentAttempt then return 3 end
redis.call('HSET', KEYS[1],
  'archive_status', 'published',
  'archive_published_at', ARGV[2],
  'archive_publish_attempt', ARGV[3])
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[1])
return 1
`;

export class OnlineBattleStore {
  private readonly blueprintCache = new Map<string, BattleBlueprintV1>();
  private archivePendingListener: (() => void) | undefined;
  private terminalOutboxPendingListener: (() => void) | undefined;
  private resolutionTaskPendingListener: (() => void) | undefined;

  setArchivePendingListener(listener: (() => void) | undefined): void {
    this.archivePendingListener = listener;
  }

  setTerminalOutboxPendingListener(listener: (() => void) | undefined): void {
    this.terminalOutboxPendingListener = listener;
  }

  setResolutionTaskPendingListener(listener: (() => void) | undefined): void {
    this.resolutionTaskPendingListener = listener;
  }

  async connect(): Promise<void> {
    await redis.ping();
  }

  async repairDerivedIndexTypes(): Promise<number> {
    const types = await Promise.all(
      ONLINE_BATTLE_DERIVED_INDEX_TYPES.map(([key]) => redis.type(key)),
    );
    const invalidKeys = ONLINE_BATTLE_DERIVED_INDEX_TYPES.flatMap(
      ([key, expectedType], index) => {
        const actualType = types[index];
        return actualType !== 'none' && actualType !== expectedType
          ? [key]
          : [];
      },
    );
    if (invalidKeys.length === 0) return 0;
    await redis.del(...invalidKeys);
    console.error('[online-battle] replaced invalid derived Redis indexes', {
      keys: invalidKeys,
    });
    return invalidKeys.length;
  }

  async create(runtime: OnlineBattleRuntimeStateV1): Promise<void> {
    const { match } = runtime;
    const orchestration = runtime.orchestration;
    const orchestrationKey = orchestration
      ? arenaStartIndexKey(orchestration.roomId, orchestration.startRequestId)
      : `battle:online:arena-start-disabled:${match.matchId}`;
    const cleanupManifest = createCleanupManifest(runtime);
    const participants = createStoredParticipants(runtime);
    const invitedPlayerIds = participants
      .filter((participant) => participant.status === 'invited')
      .map((participant) => participant.userId);
    const result = Number(
      await getRedisClient().eval(
        CREATE_MATCH_LUA,
        9 + invitedPlayerIds.length,
        battleOnlineMatchKey(match.matchId),
        BATTLE_ONLINE_DEADLINES_KEY,
        BATTLE_ONLINE_RESOLVING_KEY,
        BATTLE_ONLINE_ALL_MATCHES_KEY,
        BATTLE_ONLINE_WAITING_KEY,
        orchestrationKey,
        BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
        BATTLE_ONLINE_WAITING_CLAIMS_KEY,
        BATTLE_RESOLUTION_TASK_PENDING_KEY,
        ...invitedPlayerIds.map(invitationKey),
        String(runtime.storageRevision),
        JSON.stringify(stripBlueprint(stripPendingReplay(runtime))),
        match.status,
        nullableNumber(indexedDeadline(runtime)),
        String(match.updatedAt),
        match.matchId,
        nullableNumber(indexedAcceptDeadline(runtime)),
        orchestration ? '1' : '',
        String(ARENA_START_INDEX_TTL_SECONDS),
        JSON.stringify(match.battle.blueprint),
        JSON.stringify(cleanupManifest),
        JSON.stringify(participants),
        String(match.createdAt),
        String(match.revision),
        String(runtime.clientEventSeq),
      ),
    );
    if (result === -1)
      throw new Error('Battle arena orchestration already exists');
    if (result !== 1)
      throw new Error(`Battle match already exists: ${match.matchId}`);
    this.cacheBlueprint(match.matchId, match.battle.blueprint);
  }

  async get(matchId: string): Promise<OnlineBattleRuntimeStateV1> {
    const key = battleOnlineMatchKey(matchId);
    const cached = this.blueprintCache.get(matchId);
    let stateJson: string | null;
    let participantsJson: string | null;
    let blueprintJson: string | null;
    try {
      [[stateJson, participantsJson], blueprintJson] = await Promise.all([
        redis.hmget(key, 'state', 'participants'),
        cached ? Promise.resolve(null) : redis.hget(key, 'blueprint'),
      ]);
    } catch (error) {
      await this.discardInvalidMatch(matchId);
      throw new Error(
        `Unsupported or corrupt battle match was discarded: ${matchId}`,
        { cause: error },
      );
    }
    if (!stateJson) {
      await this.pruneMissingMatchIndexes(matchId);
      throw new Error(`Unknown battle match: ${matchId}`);
    }
    try {
      const blueprint = cached ?? parseBlueprint(blueprintJson, matchId);
      const runtime = parseRuntime(stateJson, matchId, blueprint);
      assertStoredParticipants(participantsJson, runtime);
      this.cacheBlueprint(matchId, runtime.match.battle.blueprint);
      return runtime;
    } catch (error) {
      console.error(
        '[online-battle] discarding unsupported or corrupt runtime',
        {
          matchId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      await this.discardInvalidMatch(matchId);
      throw new Error(
        `Unsupported or corrupt battle match was discarded: ${matchId}`,
        {
          cause: error,
        },
      );
    }
  }

  async getSyncCursor(
    matchId: string,
    playerId: string,
  ): Promise<{
    readonly revision: number;
    readonly eventSeq: number;
  }> {
    let revisionValue: string | null = null;
    let eventSeqValue: string | null = null;
    let participantsValue: string | null = null;
    let readCompleted = false;
    try {
      [revisionValue, eventSeqValue, participantsValue] = await redis.hmget(
        battleOnlineMatchKey(matchId),
        'match_revision',
        'client_event_seq',
        'participants',
      );
      readCompleted = true;
      const revision = Number(revisionValue);
      const eventSeq = Number(eventSeqValue);
      if (
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        !Number.isSafeInteger(eventSeq) ||
        eventSeq < 0 ||
        !participantsValue
      ) {
        throw new Error('Online battle sync cursor is invalid');
      }
      const participants = parseStoredParticipants(participantsValue);
      const accepted = participants.some(
        (participant) =>
          participant !== null &&
          typeof participant === 'object' &&
          'userId' in participant &&
          participant.userId === playerId &&
          'status' in participant &&
          participant.status === 'accepted',
      );
      if (!accepted) throw new Error('Player has not accepted the battle');
      return { revision, eventSeq };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Player has not accepted the battle'
      ) {
        throw error;
      }
      if (
        readCompleted &&
        revisionValue === null &&
        eventSeqValue === null &&
        participantsValue === null
      ) {
        await this.pruneMissingMatchIndexes(matchId);
        throw new Error(`Unknown battle match: ${matchId}`, { cause: error });
      }
      await this.discardInvalidMatch(matchId);
      throw new Error(
        `Unsupported or corrupt battle match was discarded: ${matchId}`,
        { cause: error },
      );
    }
  }

  async getPresentationWindow(
    runtime: OnlineBattleRuntimeStateV1,
  ): Promise<CompactBattlePresentationWindowV1 | undefined> {
    if (runtime.match.status !== 'presenting' || !runtime.match.presentation) {
      return undefined;
    }
    try {
      const value = await redis.get(
        battleOnlinePresentationKey(runtime.match.matchId),
      );
      if (!value) throw new Error('Online battle presentation blob is missing');
      const window = JSON.parse(value) as CompactBattlePresentationWindowV1;
      assertStoredPresentationWindow(window, runtime);
      return window;
    } catch (error) {
      await this.discardInvalidMatch(runtime.match.matchId);
      throw new Error(
        `Unsupported or corrupt battle match was discarded: ${runtime.match.matchId}`,
        { cause: error },
      );
    }
  }

  async getEventSnapshot(
    matchId: string,
    eventSeq: number,
  ): Promise<OnlineBattleEventSnapshotV1 | null> {
    const field = String(eventSeq);
    const value = await redis.hget(
      battleOnlineEventSnapshotsKey(matchId),
      field,
    );
    if (!value) return null;
    try {
      const blueprint = await this.loadBlueprint(matchId);
      return parseEventSnapshot(value, matchId, eventSeq, blueprint);
    } catch (error) {
      await redis
        .hdel(battleOnlineEventSnapshotsKey(matchId), field)
        .catch(() => undefined);
      console.warn('[online-battle] discarded invalid event snapshot', {
        matchId,
        eventSeq,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Invalid runtime payloads are never migrated. Release orchestration state
   * from the stable battle-to-room index, then remove every generic battle
   * index so poison data cannot keep a player in an active match forever.
   */
  async discardInvalidMatch(matchId: string): Promise<void> {
    const storedManifest = await redis
      .hget(battleOnlineMatchKey(matchId), 'cleanup_manifest')
      .catch(() => null);
    const manifest = parseCleanupManifestOrFallback(storedManifest, matchId);
    const terminalAt = Date.now();
    const event = createTerminalEvent({
      matchId,
      terminalStatus: 'cancelled',
      terminalReason: 'corrupt_runtime',
      stateRevision: 0,
      terminalAt,
    });
    await releaseArenaRoomForBattle(manifest).catch((error) => {
      console.error('[online-battle] corrupt match arena release failed', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    await getRedisClient().eval(
      DISCARD_MATCH_LUA,
      16,
      battleOnlineMatchKey(matchId),
      BATTLE_ONLINE_ALL_MATCHES_KEY,
      BATTLE_ONLINE_DEADLINES_KEY,
      BATTLE_ONLINE_RESOLVING_KEY,
      BATTLE_ONLINE_WAITING_KEY,
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
      battleReplayRoundsKey(matchId),
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      battleTerminalOutboxKey(matchId),
      BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
      BATTLE_ONLINE_WAITING_CLAIMS_KEY,
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      battleOnlineCommandReceiptsKey(matchId),
      battleReplayArchivePayloadKey(matchId),
      battleOnlinePresentationKey(matchId),
      matchId,
      JSON.stringify(event),
      JSON.stringify(manifest),
      String(terminalAt),
      String(TERMINAL_OUTBOX_TTL_SECONDS),
    );
    this.terminalOutboxPendingListener?.();
    this.blueprintCache.delete(matchId);
  }

  async compareAndSet(
    current: OnlineBattleRuntimeStateV1,
    next: OnlineBattleRuntimeStateV1,
    commandReceipt?: OnlineBattleCommandReceiptRecordV1,
    eventSnapshot?: OnlineBattleEventSnapshotV1,
  ): Promise<boolean> {
    const matchId = current.match.matchId;
    const clientEventAdvanced =
      next.clientEventSeq === current.clientEventSeq + 1;
    if (
      next.match.matchId !== matchId ||
      next.storageRevision !== current.storageRevision + 1 ||
      (next.clientEventSeq !== current.clientEventSeq &&
        !clientEventAdvanced) ||
      Boolean(eventSnapshot) !== clientEventAdvanced
    ) {
      throw new Error('Invalid online battle CAS state');
    }
    const shouldArchive =
      next.match.status === 'finished' && current.match.status !== 'finished';
    const shouldStageTerminal =
      (next.match.status === 'finished' || next.match.status === 'cancelled') &&
      next.match.status !== current.match.status;
    const terminalEvent = shouldStageTerminal
      ? createTerminalEvent({
          matchId,
          terminalStatus: next.match.status,
          terminalReason:
            next.match.status === 'finished'
              ? 'battle_completed'
              : (next.termination?.reason ??
                (() => {
                  throw new Error(
                    'Cancelled battle is missing termination reason',
                  );
                })()),
          stateRevision: next.match.revision,
          terminalAt: next.match.updatedAt,
        })
      : null;
    const cleanupManifest = shouldStageTerminal
      ? createCleanupManifest(current)
      : null;
    const resolutionTask = shouldStageResolutionTask(current, next)
      ? createResolutionTask(next)
      : null;
    const newlyAcceptedPlayerIds = next.acceptedPlayerIds.filter(
      (playerId) => !current.acceptedPlayerIds.includes(playerId),
    );
    if (newlyAcceptedPlayerIds.length > 1) {
      throw new Error('Online battle CAS may accept only one player at a time');
    }
    const acceptedPlayerId = newlyAcceptedPlayerIds[0];
    const participants = acceptedPlayerId
      ? createStoredParticipants(next)
      : null;
    const pendingRound = next.replay.pendingRound;
    const pendingPresentationWindow = next.pendingPresentationWindow;
    const shouldDeletePresentation =
      current.match.status === 'presenting' &&
      next.match.status !== 'presenting';
    const storedEventSnapshot = eventSnapshot
      ? serializeEventSnapshot(eventSnapshot, next)
      : '';
    const result = Number(
      await getRedisClient().eval(
        CAS_STATE_LUA,
        17,
        battleOnlineMatchKey(matchId),
        BATTLE_ONLINE_DEADLINES_KEY,
        BATTLE_ONLINE_RESOLVING_KEY,
        BATTLE_ONLINE_ALL_MATCHES_KEY,
        BATTLE_ONLINE_WAITING_KEY,
        BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
        battleReplayRoundsKey(matchId),
        BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
        battleTerminalOutboxKey(matchId),
        BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
        BATTLE_ONLINE_WAITING_CLAIMS_KEY,
        BATTLE_RESOLUTION_TASK_PENDING_KEY,
        battleOnlineCommandReceiptsKey(matchId),
        battleReplayArchivePayloadKey(matchId),
        acceptedPlayerId
          ? invitationKey(acceptedPlayerId)
          : `battle:invites:disabled:${matchId}`,
        battleOnlinePresentationKey(matchId),
        battleOnlineEventSnapshotsKey(matchId),
        String(current.storageRevision),
        String(next.storageRevision),
        JSON.stringify(
          stripBlueprint(stripPendingPresentation(stripPendingReplay(next))),
        ),
        next.match.status,
        nullableNumber(indexedDeadline(next)),
        String(next.match.updatedAt),
        matchId,
        nullableNumber(indexedAcceptDeadline(next)),
        pendingRound ? JSON.stringify(pendingRound) : '',
        shouldArchive ? String(next.storageRevision) : '',
        terminalEvent ? JSON.stringify(terminalEvent) : '',
        cleanupManifest ? JSON.stringify(cleanupManifest) : '',
        String(TERMINAL_OUTBOX_TTL_SECONDS),
        resolutionTask ? JSON.stringify(resolutionTask) : '',
        commandReceipt ? commandReceiptField(commandReceipt) : '',
        commandReceipt ? JSON.stringify(commandReceipt) : '',
        participants ? JSON.stringify(participants) : '',
        String(next.match.revision),
        String(next.clientEventSeq),
        pendingPresentationWindow
          ? JSON.stringify(pendingPresentationWindow)
          : '',
        shouldDeletePresentation ? '1' : '',
        eventSnapshot ? String(eventSnapshot.eventSeq) : '',
        storedEventSnapshot,
        eventSnapshot &&
        eventSnapshot.eventSeq >= ONLINE_BATTLE_EVENT_SNAPSHOT_MAX_ENTRIES
          ? String(
              eventSnapshot.eventSeq -
                ONLINE_BATTLE_EVENT_SNAPSHOT_MAX_ENTRIES,
            )
          : '',
        String(ONLINE_BATTLE_EVENT_SNAPSHOT_TTL_SECONDS),
      ),
    );
    if (result === 1) {
      if (storedEventSnapshot) {
        observeOnlineBattleMetric(
          'event_snapshot_bytes',
          Buffer.byteLength(storedEventSnapshot),
        );
      }
      if (shouldArchive) this.archivePendingListener?.();
      if (terminalEvent) this.terminalOutboxPendingListener?.();
      if (resolutionTask) this.resolutionTaskPendingListener?.();
      return true;
    }
    if (result === -2) throw new Error(`Unknown battle match: ${matchId}`);
    if (result === -1) {
      observeOnlineBattleMetric('cas_conflict_total');
      return false;
    }
    if (result === -3) return false;
    if (result === -4) return false;
    throw new Error(`Unexpected online battle CAS result: ${result}`);
  }

  async getCommandReceipt(
    matchId: string,
    playerId: string,
    requestId: string,
  ): Promise<OnlineBattleCommandReceiptRecordV1 | null> {
    try {
      const value = await redis.hget(
        battleOnlineCommandReceiptsKey(matchId),
        commandReceiptField({ playerId, requestId }),
      );
      return value
        ? parseCommandReceipt(value, matchId, playerId, requestId)
        : null;
    } catch (error) {
      await this.discardInvalidMatch(matchId);
      throw new Error(
        `Unsupported or corrupt battle match was discarded: ${matchId}`,
        { cause: error },
      );
    }
  }

  countCommandReceipts(matchId: string): Promise<number> {
    return redis.hlen(battleOnlineCommandReceiptsKey(matchId));
  }

  async storeCommandReceiptAtRevision(
    matchId: string,
    storageRevision: number,
    record: OnlineBattleCommandReceiptRecordV1,
  ): Promise<'stored' | 'existing' | 'stale'> {
    const result = Number(
      await getRedisClient().eval(
        STORE_COMMAND_RECEIPT_LUA,
        2,
        battleOnlineMatchKey(matchId),
        battleOnlineCommandReceiptsKey(matchId),
        String(storageRevision),
        commandReceiptField(record),
        JSON.stringify(record),
      ),
    );
    if (result === 1) return 'stored';
    if (result === 0) return 'existing';
    if (result === -1) return 'stale';
    if (result === -2) throw new Error(`Unknown battle match: ${matchId}`);
    throw new Error(`Unexpected command receipt store result: ${result}`);
  }

  async findArenaMatch(
    roomId: string,
    startRequestId: string,
  ): Promise<string | null> {
    const key = arenaStartIndexKey(roomId, startRequestId);
    const matchId = await redis.get(key);
    if (!matchId) return null;
    if ((await redis.exists(battleOnlineMatchKey(matchId))) === 1)
      return matchId;
    await redis.del(key);
    await this.pruneMissingMatchIndexes(matchId);
    return null;
  }

  claimExpiredMatchIds(now = Date.now(), limit = 100): Promise<string[]> {
    return getRedisClient().eval(
      CLAIM_DUE_LUA,
      2,
      BATTLE_ONLINE_DEADLINES_KEY,
      BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
      String(now),
      String(now + SCHEDULE_CLAIM_LEASE_MS),
      String(limit),
    ) as Promise<string[]>;
  }

  async scanResolvingMatchIds(cursor = '0', count = 100) {
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_ONLINE_RESOLVING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async scanRuntimeMatchIds(cursor = '0', count = 100) {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'battle:online:*',
      'COUNT',
      count,
    );
    const matchIds = keys.flatMap((key) => {
      if (ONLINE_BATTLE_RESERVED_ROOT_KEYS.has(key)) return [];
      const match = /^battle:online:([A-Za-z0-9_-]{1,120})$/.exec(key);
      return match?.[1] ? [match[1]] : [];
    });
    return { cursor: nextCursor, matchIds };
  }

  async scanTerminalOutboxMatchIds(cursor = '0', count = 100) {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'battle:terminal:outbox:*',
      'COUNT',
      count,
    );
    const matchIds = keys.flatMap((key) => {
      if (key === BATTLE_TERMINAL_OUTBOX_PENDING_KEY) return [];
      const match = /^battle:terminal:outbox:([A-Za-z0-9_-]{1,120})$/.exec(key);
      return match?.[1] ? [match[1]] : [];
    });
    return { cursor: nextCursor, matchIds };
  }

  async reconcileTerminalOutboxTracking(matchId: string): Promise<void> {
    await this.getTerminalOutbox(matchId);
    await getRedisClient().eval(
      RECONCILE_TERMINAL_OUTBOX_TRACKING_LUA,
      3,
      battleTerminalOutboxKey(matchId),
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      matchId,
    );
  }

  claimExpiredWaitingMatchIds(
    now = Date.now(),
    limit = 100,
  ): Promise<string[]> {
    return getRedisClient().eval(
      CLAIM_DUE_LUA,
      2,
      BATTLE_ONLINE_WAITING_KEY,
      BATTLE_ONLINE_WAITING_CLAIMS_KEY,
      String(now),
      String(now + SCHEDULE_CLAIM_LEASE_MS),
      String(limit),
    ) as Promise<string[]>;
  }

  async reconcileMatchIndexes(matchId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let runtime: OnlineBattleRuntimeStateV1;
      try {
        runtime = await this.get(matchId);
      } catch (error) {
        if (String(error).includes('Unknown battle match')) return false;
        throw error;
      }
      const active =
        runtime.match.status !== 'finished' &&
        runtime.match.status !== 'cancelled';
      if (!active) {
        const hasTerminalOutbox =
          (await redis.exists(battleTerminalOutboxKey(matchId))) === 1;
        if (!hasTerminalOutbox) {
          await this.repairTerminalOutbox(matchId);
        }
      }
      const hasResolutionTask =
        (await redis.hexists(
          battleOnlineMatchKey(matchId),
          'resolution_task',
        )) === 1;
      const deadline =
        active && !(runtime.match.status === 'resolving' && hasResolutionTask)
          ? indexedDeadline(runtime)
          : null;
      const result = Number(
        await getRedisClient().eval(
          RECONCILE_ACTIVE_INDEXES_LUA,
          7,
          battleOnlineMatchKey(matchId),
          BATTLE_ONLINE_ALL_MATCHES_KEY,
          BATTLE_ONLINE_DEADLINES_KEY,
          BATTLE_ONLINE_RESOLVING_KEY,
          BATTLE_ONLINE_WAITING_KEY,
          BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
          BATTLE_ONLINE_WAITING_CLAIMS_KEY,
          String(runtime.storageRevision),
          active ? '1' : '0',
          nullableNumber(deadline),
          active && runtime.match.status === 'resolving' ? '1' : '0',
          active ? nullableNumber(indexedAcceptDeadline(runtime)) : '',
          matchId,
          hasResolutionTask ? '1' : '0',
        ),
      );
      if (result === 1) return true;
      if (result === -1) {
        await this.pruneMissingMatchIndexes(matchId);
        return false;
      }
    }
    return false;
  }

  async pruneMissingMatchIndexes(matchId: string): Promise<void> {
    await getRedisClient().eval(
      PRUNE_ACTIVE_INDEXES_LUA,
      9,
      BATTLE_ONLINE_ALL_MATCHES_KEY,
      BATTLE_ONLINE_DEADLINES_KEY,
      BATTLE_ONLINE_RESOLVING_KEY,
      BATTLE_ONLINE_WAITING_KEY,
      BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
      BATTLE_ONLINE_WAITING_CLAIMS_KEY,
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      battleOnlineCommandReceiptsKey(matchId),
      battleOnlinePresentationKey(matchId),
      matchId,
    );
    this.blueprintCache.delete(matchId);
  }

  async pruneOrphanedMatchIndexes(matchIds: readonly string[]): Promise<void> {
    const uniqueMatchIds = [...new Set(matchIds)];
    const exists = await Promise.all(
      uniqueMatchIds.map((matchId) =>
        redis.exists(battleOnlineMatchKey(matchId)),
      ),
    );
    await Promise.all(
      uniqueMatchIds.flatMap((matchId, index) =>
        exists[index] === 0 ? [this.pruneMissingMatchIndexes(matchId)] : [],
      ),
    );
  }

  async scanDerivedIndexMatchIds(
    index:
      | 'all'
      | 'deadlines'
      | 'resolving'
      | 'waiting'
      | 'deadline_claims'
      | 'waiting_claims',
    cursor = '0',
    count = 100,
  ) {
    const key = {
      all: BATTLE_ONLINE_ALL_MATCHES_KEY,
      deadlines: BATTLE_ONLINE_DEADLINES_KEY,
      resolving: BATTLE_ONLINE_RESOLVING_KEY,
      waiting: BATTLE_ONLINE_WAITING_KEY,
      deadline_claims: BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
      waiting_claims: BATTLE_ONLINE_WAITING_CLAIMS_KEY,
    }[index];
    if (index === 'all' || index === 'resolving') {
      const [nextCursor, matchIds] = await redis.sscan(
        key,
        cursor,
        'COUNT',
        count,
      );
      return { cursor: nextCursor, matchIds };
    }
    const [nextCursor, entries] = await redis.zscan(
      key,
      cursor,
      'COUNT',
      count,
    );
    return {
      cursor: nextCursor,
      matchIds: entries.filter((_, entryIndex) => entryIndex % 2 === 0),
    };
  }

  async scanPendingArchiveMatchIds(cursor = '0', count = 100) {
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async scanPendingTerminalOutboxMatchIds(cursor = '0', count = 100) {
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async scanPendingResolutionTaskMatchIds(cursor = '0', count = 100) {
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async getResolutionTaskDelivery(matchId: string): Promise<{
    readonly task: BattleResolutionTaskV1;
    readonly publishAttempt: number;
  } | null> {
    const [value, publishAttemptValue] = await redis.hmget(
      battleOnlineMatchKey(matchId),
      'resolution_task',
      'resolution_task_publish_attempt',
    );
    if (!value) {
      await redis.srem(BATTLE_RESOLUTION_TASK_PENDING_KEY, matchId);
      return null;
    }
    try {
      const publishAttempt = Number(publishAttemptValue);
      if (!Number.isInteger(publishAttempt) || publishAttempt < 1) {
        throw new Error('Battle resolution task publish attempt is invalid');
      }
      return {
        task: BattleResolutionTaskSchema.parse(JSON.parse(value)),
        publishAttempt,
      };
    } catch (error) {
      await redis
        .multi()
        .hdel(
          battleOnlineMatchKey(matchId),
          'resolution_task',
          'resolution_task_status',
          'resolution_task_published_at',
          'resolution_task_publish_attempt',
        )
        .srem(BATTLE_RESOLUTION_TASK_PENDING_KEY, matchId)
        .exec();
      throw error;
    }
  }

  async stageResolutionTask(
    runtime: OnlineBattleRuntimeStateV1,
  ): Promise<boolean> {
    if (runtime.match.status !== 'resolving' || !runtime.match.resolving)
      return false;
    if (
      runtime.resolutionRetry &&
      Date.now() < runtime.resolutionRetry.nextRetryAt
    ) {
      return false;
    }
    const task = createResolutionTask(runtime);
    const result = Number(
      await getRedisClient().eval(
        STAGE_RESOLUTION_TASK_LUA,
        3,
        battleOnlineMatchKey(runtime.match.matchId),
        BATTLE_RESOLUTION_TASK_PENDING_KEY,
        BATTLE_ONLINE_DEADLINES_KEY,
        String(runtime.storageRevision),
        JSON.stringify(task),
        runtime.match.matchId,
        String(Date.now() - RESOLUTION_TASK_REPUBLISH_LEASE_MS),
      ),
    );
    if (result === 1) this.resolutionTaskPendingListener?.();
    if (result === 3) this.resolutionTaskPendingListener?.();
    if (result === 1 || result === 2 || result === 3) return true;
    if (result === 0 || result === -2) return false;
    if (result === -1) {
      await this.pruneMissingMatchIndexes(runtime.match.matchId);
      return false;
    }
    throw new Error(`Unexpected resolution task stage result: ${result}`);
  }

  async markResolutionTaskPublished(
    matchId: string,
    task: BattleResolutionTaskV1,
    publishAttempt: number,
  ): Promise<boolean> {
    const result = Number(
      await getRedisClient().eval(
        MARK_RESOLUTION_TASK_PUBLISHED_LUA,
        2,
        battleOnlineMatchKey(matchId),
        BATTLE_RESOLUTION_TASK_PENDING_KEY,
        matchId,
        JSON.stringify(task),
        String(publishAttempt),
        String(Date.now()),
      ),
    );
    return result === 1;
  }

  async getTerminalOutbox(
    matchId: string,
  ): Promise<BattleTerminalOutboxV1 | null> {
    let eventJson: string | null;
    let manifestJson: string | null;
    try {
      [eventJson, manifestJson] = await redis.hmget(
        battleTerminalOutboxKey(matchId),
        'event',
        'manifest',
      );
    } catch (error) {
      console.error('[battle-terminal] replacing invalid terminal outbox key', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.repairTerminalOutbox(matchId, true);
    }
    try {
      if (!eventJson || !manifestJson) {
        throw new Error('Battle terminal outbox is incomplete');
      }
      return {
        event: BattleTerminalEventSchema.parse(JSON.parse(eventJson)),
        manifest: BattleCleanupManifestSchema.parse(JSON.parse(manifestJson)),
      };
    } catch (error) {
      console.error('[battle-terminal] repairing corrupt terminal outbox', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.repairTerminalOutbox(matchId);
    }
  }

  private async repairTerminalOutbox(
    matchId: string,
    replaceKey = false,
  ): Promise<BattleTerminalOutboxV1> {
    const [status, stateRevisionValue, updatedAtValue, manifestValue] =
      await redis.hmget(
        battleOnlineMatchKey(matchId),
        'status',
        'state_id',
        'updated_at',
        'cleanup_manifest',
      );
    const manifest = parseCleanupManifestOrFallback(manifestValue, matchId);
    const terminalStatus = status === 'finished' ? 'finished' : 'cancelled';
    const stateRevision = Number(stateRevisionValue);
    const updatedAt = Number(updatedAtValue);
    const event = createTerminalEvent({
      matchId,
      terminalStatus,
      terminalReason:
        terminalStatus === 'finished' ? 'battle_completed' : 'corrupt_runtime',
      stateRevision:
        Number.isSafeInteger(stateRevision) && stateRevision >= 0
          ? stateRevision
          : 0,
      terminalAt:
        Number.isFinite(updatedAt) && updatedAt >= 0 ? updatedAt : Date.now(),
    });
    const transaction = redis.multi();
    if (replaceKey) transaction.del(battleTerminalOutboxKey(matchId));
    await transaction
      .hset(
        battleTerminalOutboxKey(matchId),
        'event',
        JSON.stringify(event),
        'manifest',
        JSON.stringify(manifest),
        'publish_status',
        'pending',
        'created_at',
        String(Date.now()),
      )
      .expire(battleTerminalOutboxKey(matchId), TERMINAL_OUTBOX_TTL_SECONDS)
      .sadd(BATTLE_TERMINAL_OUTBOX_PENDING_KEY, matchId)
      .sadd(BATTLE_TERMINAL_CLEANUP_PENDING_KEY, matchId)
      .exec();
    this.terminalOutboxPendingListener?.();
    return { event, manifest };
  }

  async markTerminalOutboxPublished(matchId: string): Promise<void> {
    await getRedisClient().eval(
      MARK_TERMINAL_OUTBOX_PUBLISHED_LUA,
      3,
      battleTerminalOutboxKey(matchId),
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      matchId,
      String(Date.now()),
    );
  }

  async markTerminalCleanupCompleted(matchId: string): Promise<void> {
    await getRedisClient().eval(
      MARK_TERMINAL_CLEANUP_COMPLETED_LUA,
      3,
      battleTerminalOutboxKey(matchId),
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      matchId,
      String(Date.now()),
      String(TERMINAL_COMPLETED_TTL_SECONDS),
    );
  }

  async finalizeTerminalIndexes(outbox: BattleTerminalOutboxV1): Promise<void> {
    const { event, manifest } = outbox;
    const orchestrationKey =
      manifest.roomId && manifest.startRequestId
        ? arenaStartIndexKey(manifest.roomId, manifest.startRequestId)
        : `battle:online:arena-start-disabled:${event.matchId}`;
    await getRedisClient().eval(
      FINALIZE_TERMINAL_INDEXES_LUA,
      13 + manifest.playerIds.length,
      battleOnlineMatchKey(event.matchId),
      battleReplayRoundsKey(event.matchId),
      BATTLE_ONLINE_ALL_MATCHES_KEY,
      BATTLE_ONLINE_DEADLINES_KEY,
      BATTLE_ONLINE_RESOLVING_KEY,
      BATTLE_ONLINE_WAITING_KEY,
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
      orchestrationKey,
      BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
      BATTLE_ONLINE_WAITING_CLAIMS_KEY,
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      battleOnlineCommandReceiptsKey(event.matchId),
      ...manifest.playerIds.map(invitationKey),
      event.matchId,
      String(TERMINAL_OUTBOX_TTL_SECONDS),
      event.terminalStatus,
    );
  }

  async scanPendingTerminalCleanupMatchIds(cursor = '0', count = 100) {
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async getTerminalPendingCounts(): Promise<{
    outbox: number;
    cleanup: number;
  }> {
    const [outbox, cleanup] = await Promise.all([
      redis.scard(BATTLE_TERMINAL_OUTBOX_PENDING_KEY),
      redis.scard(BATTLE_TERMINAL_CLEANUP_PENDING_KEY),
    ]);
    return { outbox, cleanup };
  }

  listUnconfirmedArchiveMatchIds(
    now = Date.now(),
    limit = 100,
  ): Promise<string[]> {
    return redis.zrangebyscore(
      BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
      0,
      now - BATTLE_REPLAY_CONFIRM_TIMEOUT_MS,
      'LIMIT',
      0,
      limit,
    );
  }

  async buildReplayArchive(
    matchId: string,
    expectedStorageRevision: number,
  ): Promise<BattleReplayV1 | null> {
    const key = battleOnlineMatchKey(matchId);
    let values: (string | null)[];
    let storedRoundsJson: string[];
    let archiveRevisionJson: string | null;
    try {
      [values, storedRoundsJson, archiveRevisionJson] = await Promise.all([
        redis.hmget(key, 'state', 'initial_state', 'blueprint'),
        redis.lrange(battleReplayRoundsKey(matchId), 0, -1),
        redis.hget(
          battleReplayArchivePayloadKey(matchId),
          'expected_storage_revision',
        ),
      ]);
    } catch (error) {
      if (isWrongTypeRedisError(error)) return null;
      throw error;
    }
    const [stateJson, initialStateJson, blueprintJson] = values;
    if (
      !stateJson ||
      !initialStateJson ||
      !blueprintJson ||
      !archiveRevisionJson
    ) {
      return null;
    }
    if (Number(archiveRevisionJson) !== expectedStorageRevision) return null;
    try {
      const blueprint = parseBlueprint(blueprintJson, matchId);
      const runtime = parseRuntime(stateJson, matchId, blueprint);
      if (
        runtime.storageRevision !== expectedStorageRevision ||
        runtime.match.status !== 'finished'
      )
        return null;
      const initial = parseRuntime(initialStateJson, matchId, blueprint);
      const rounds = storedRoundsJson.map(
        (value) => JSON.parse(value) as BattleReplayV1['rounds'][number],
      );
      return parseBattleReplay(
        buildReplay(runtime, initial.match.battle, rounds),
      );
    } catch (error) {
      console.error('[battle-replay] unrecoverable replay source is invalid', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async markArchivePublished(
    matchId: string,
    attempt: number,
    expectedStorageRevision: number,
  ): Promise<void> {
    const publishedAt = Date.now();
    const result = Number(
      await getRedisClient().eval(
        MARK_ARCHIVE_PUBLISHED_LUA,
        3,
        battleReplayArchivePayloadKey(matchId),
        BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
        BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
        matchId,
        String(publishedAt),
        String(attempt),
        String(expectedStorageRevision),
      ),
    );
    if ([1, 2, 3].includes(result)) return;
    if (result === 0) throw new Error(`Unknown battle match: ${matchId}`);
    throw new Error(`Battle replay archive state conflict: ${matchId}`);
  }

  async retire(matchId: string): Promise<void> {
    await redis
      .multi()
      .expire(battleOnlineMatchKey(matchId), BATTLE_REPLAY_ARCHIVED_TTL_SECONDS)
      .expire(
        battleReplayRoundsKey(matchId),
        BATTLE_REPLAY_ARCHIVED_TTL_SECONDS,
      )
      .expire(
        battleOnlineCommandReceiptsKey(matchId),
        BATTLE_REPLAY_ARCHIVED_TTL_SECONDS,
      )
      .srem(BATTLE_ONLINE_ALL_MATCHES_KEY, matchId)
      .zrem(BATTLE_ONLINE_DEADLINES_KEY, matchId)
      .zrem(BATTLE_ONLINE_WAITING_KEY, matchId)
      .zrem(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY, matchId)
      .zrem(BATTLE_ONLINE_WAITING_CLAIMS_KEY, matchId)
      .srem(BATTLE_ONLINE_RESOLVING_KEY, matchId)
      .srem(BATTLE_RESOLUTION_TASK_PENDING_KEY, matchId)
      .exec();
  }

  private cacheBlueprint(matchId: string, blueprint: BattleBlueprintV1): void {
    this.blueprintCache.delete(matchId);
    this.blueprintCache.set(matchId, blueprint);
    if (this.blueprintCache.size > 128) {
      const oldest = this.blueprintCache.keys().next().value;
      if (oldest) this.blueprintCache.delete(oldest);
    }
  }

  private async loadBlueprint(matchId: string): Promise<BattleBlueprintV1> {
    const cached = this.blueprintCache.get(matchId);
    if (cached) return cached;
    const blueprint = parseBlueprint(
      await redis.hget(battleOnlineMatchKey(matchId), 'blueprint'),
      matchId,
    );
    this.cacheBlueprint(matchId, blueprint);
    return blueprint;
  }
}

function indexedDeadline(runtime: OnlineBattleRuntimeStateV1): number | null {
  if (runtime.acceptedPlayerIds.length < runtime.match.controllers.length)
    return null;
  if (runtime.match.status === 'presenting') {
    return runtime.match.presentation?.scheduledEndsAt ?? null;
  }
  if (runtime.match.status === 'resolving' && runtime.resolutionRetry) {
    return runtime.resolutionRetry.nextRetryAt;
  }
  if (
    runtime.match.status === 'resolution_failed' &&
    runtime.match.resolving?.failure
  ) {
    return (
      runtime.match.resolving.failure.failedAt +
      ONLINE_BATTLE_RESOLUTION_FAILURE_TIMEOUT_MS
    );
  }
  return runtime.match.status === 'planning'
    ? (runtime.match.planning?.deadlineAt ?? null)
    : null;
}

function indexedAcceptDeadline(
  runtime: OnlineBattleRuntimeStateV1,
): number | null {
  return runtime.acceptedPlayerIds.length < runtime.match.controllers.length
    ? runtime.match.createdAt + ONLINE_BATTLE_ACCEPT_TIMEOUT_MS
    : null;
}

function shouldStageResolutionTask(
  current: OnlineBattleRuntimeStateV1,
  next: OnlineBattleRuntimeStateV1,
): boolean {
  if (next.match.status !== 'resolving' || !next.match.resolving) return false;
  return (
    current.match.status !== 'resolving' ||
    current.match.resolving?.commandSet.commandSetId !==
      next.match.resolving.commandSet.commandSetId
  );
}

function createResolutionTask(
  runtime: OnlineBattleRuntimeStateV1,
): BattleResolutionTaskV1 {
  const resolving = runtime.match.resolving;
  if (runtime.match.status !== 'resolving' || !resolving) {
    throw new Error('Cannot create a resolution task outside resolving state');
  }
  const attempt = (runtime.resolutionRetry?.attempt ?? 0) + 1;
  return BattleResolutionTaskSchema.parse({
    version: 'battle_resolution_task_v1',
    taskId: `${resolving.commandSet.commandSetId}:resolve:${runtime.storageRevision}:${attempt}`,
    matchId: runtime.match.matchId,
    commandSetId: resolving.commandSet.commandSetId,
    expectedStorageRevision: runtime.storageRevision,
    expectedMatchRevision: runtime.match.revision,
    attempt,
    enqueuedAt: runtime.match.updatedAt,
  });
}

function stripPendingReplay(
  runtime: OnlineBattleRuntimeStateV1,
): OnlineBattleRuntimeStateV1 {
  return { ...runtime, replay: { version: 'battle_replay_accumulator_v1' } };
}

function stripPendingPresentation(
  runtime: OnlineBattleRuntimeStateV1,
): OnlineBattleRuntimeStateV1 {
  const next = { ...runtime };
  delete (next as { pendingPresentationWindow?: unknown })
    .pendingPresentationWindow;
  return next;
}

function assertStoredPresentationWindow(
  window: CompactBattlePresentationWindowV1,
  runtime: OnlineBattleRuntimeStateV1,
): void {
  const presentation = runtime.match.presentation;
  if (
    !presentation ||
    !window ||
    typeof window !== 'object' ||
    window.protocolVersion !== 1 ||
    window.resultId !== presentation.resultId ||
    window.plan?.round !== presentation.round ||
    window.startedAt !== presentation.startedAt ||
    window.readyAcceptedAt !== presentation.readyAcceptedAt ||
    window.scheduledEndsAt !== presentation.scheduledEndsAt ||
    battlePresentationSerializedBytes(window) >
      BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES
  ) {
    throw new Error('Online battle presentation blob is invalid');
  }
}

function stripBlueprint(
  runtime: OnlineBattleRuntimeStateV1,
): OnlineBattleRuntimeStateV1 {
  const battle = { ...runtime.match.battle } as Partial<BattleSaveV1>;
  delete battle.blueprint;
  return {
    ...runtime,
    match: {
      ...runtime.match,
      battle: battle as BattleSaveV1,
    },
  };
}

export function createOnlineBattleEventSnapshot(
  runtime: OnlineBattleRuntimeStateV1,
): OnlineBattleEventSnapshotV1 {
  const presentationWindow = runtime.pendingPresentationWindow;
  if (runtime.match.status === 'presenting' && !presentationWindow) {
    throw new Error('Client-visible presenting event is missing its window');
  }
  if (runtime.match.status !== 'presenting' && presentationWindow) {
    throw new Error('Non-presenting event cannot include a presentation window');
  }
  return {
    version: 'online_battle_event_snapshot_v1',
    matchId: runtime.match.matchId,
    eventSeq: runtime.clientEventSeq,
    matchRevision: runtime.match.revision,
    createdAt: runtime.match.updatedAt,
    match: runtime.match,
    acceptedPlayerIds: runtime.acceptedPlayerIds,
    ...(presentationWindow ? { presentationWindow } : {}),
  };
}

function serializeEventSnapshot(
  snapshot: OnlineBattleEventSnapshotV1,
  next: OnlineBattleRuntimeStateV1,
): string {
  if (
    snapshot.matchId !== next.match.matchId ||
    snapshot.eventSeq !== next.clientEventSeq ||
    snapshot.matchRevision !== next.match.revision ||
    snapshot.match !== next.match
  ) {
    throw new Error('Online battle event snapshot does not match CAS state');
  }
  const battle = { ...snapshot.match.battle } as Partial<BattleSaveV1>;
  delete battle.blueprint;
  const stored: StoredOnlineBattleEventSnapshotV1 = {
    version: snapshot.version,
    matchId: snapshot.matchId,
    eventSeq: snapshot.eventSeq,
    matchRevision: snapshot.matchRevision,
    createdAt: snapshot.createdAt,
    matchWithoutBlueprint: {
      ...snapshot.match,
      battle: battle as BattleSaveV1,
    },
    acceptedPlayerIds: snapshot.acceptedPlayerIds,
    ...(snapshot.presentationWindow
      ? { presentationWindow: snapshot.presentationWindow }
      : {}),
  };
  return JSON.stringify(stored);
}

function parseEventSnapshot(
  value: string,
  matchId: string,
  eventSeq: number,
  blueprint: BattleBlueprintV1,
): OnlineBattleEventSnapshotV1 {
  const stored = JSON.parse(value) as StoredOnlineBattleEventSnapshotV1;
  if (
    !stored ||
    stored.version !== 'online_battle_event_snapshot_v1' ||
    stored.matchId !== matchId ||
    stored.eventSeq !== eventSeq ||
    !Number.isSafeInteger(stored.eventSeq) ||
    !Number.isSafeInteger(stored.matchRevision) ||
    !Number.isFinite(stored.createdAt) ||
    !Array.isArray(stored.acceptedPlayerIds) ||
    !stored.acceptedPlayerIds.every((playerId) => typeof playerId === 'string')
  ) {
    throw new Error('Online battle event snapshot metadata is invalid');
  }
  const match = {
    ...stored.matchWithoutBlueprint,
    battle: {
      ...stored.matchWithoutBlueprint?.battle,
      blueprint,
    },
  } as BattleMatchStateV1;
  const runtime: OnlineBattleRuntimeStateV1 = {
    version: 'online_battle_runtime_v1',
    storageRevision: 0,
    clientEventSeq: stored.eventSeq,
    match,
    acceptedPlayerIds: stored.acceptedPlayerIds,
    replay: { version: 'battle_replay_accumulator_v1' },
  };
  assertOnlineBattleRuntimeState(runtime);
  if (
    match.revision !== stored.matchRevision ||
    match.matchId !== stored.matchId
  ) {
    throw new Error('Online battle event snapshot state is inconsistent');
  }
  if (match.status === 'presenting') {
    if (!stored.presentationWindow) {
      throw new Error('Presenting event snapshot is missing its window');
    }
    assertStoredPresentationWindow(stored.presentationWindow, runtime);
  } else if (stored.presentationWindow) {
    throw new Error('Non-presenting event snapshot contains a window');
  }
  return {
    version: stored.version,
    matchId: stored.matchId,
    eventSeq: stored.eventSeq,
    matchRevision: stored.matchRevision,
    createdAt: stored.createdAt,
    match,
    acceptedPlayerIds: stored.acceptedPlayerIds,
    ...(stored.presentationWindow
      ? { presentationWindow: stored.presentationWindow }
      : {}),
  };
}

function parseRuntime(
  value: string,
  matchId: string,
  blueprint: BattleBlueprintV1,
): OnlineBattleRuntimeStateV1 {
  const raw = JSON.parse(value) as OnlineBattleRuntimeStateV1;
  const parsed = {
    ...raw,
    match: {
      ...raw.match,
      battle: { ...raw.match?.battle, blueprint },
    },
    replay: { version: 'battle_replay_accumulator_v1' as const },
  };
  if (parsed.match.matchId !== matchId) {
    throw new Error('Stored online battle match id does not match its key');
  }
  assertOnlineBattleRuntimeState(parsed);
  return {
    ...parsed,
    replay: { version: 'battle_replay_accumulator_v1' },
  };
}

function parseBlueprint(
  value: string | null,
  matchId: string,
): BattleBlueprintV1 {
  if (!value) throw new Error(`Battle blueprint is missing: ${matchId}`);
  const blueprint = JSON.parse(value) as BattleBlueprintV1;
  if (
    blueprint.version !== 'battle_blueprint_v1' ||
    blueprint.battleId !== matchId
  ) {
    throw new Error('Invalid stored battle blueprint');
  }
  return blueprint;
}

function isWrongTypeRedisError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('WRONGTYPE');
}

function buildReplay(
  runtime: OnlineBattleRuntimeStateV1,
  initialBattle: BattleSaveV1,
  rounds: readonly BattleReplayV1['rounds'][number][],
): BattleReplayV1 {
  const outcome = runtime.match.latestResolution?.outcome;
  if (!outcome?.battleEnded || rounds.length === 0) {
    throw new Error('Finished battle is missing replay material');
  }
  return {
    version: 'battle_replay_v1',
    matchId: runtime.match.matchId,
    engineVersion: 'battle-v5',
    rulesetVersion: 'team-sync-round-v1',
    startedAt: runtime.match.createdAt,
    finishedAt: runtime.match.updatedAt,
    participants: runtime.match.controllers,
    initialBattle,
    rounds,
    finalSnapshot: createBattlePublicSnapshot(runtime.match.battle),
    outcome,
  };
}

function createCleanupManifest(
  runtime: OnlineBattleRuntimeStateV1,
): BattleCleanupManifestV1 {
  const orchestration = runtime.orchestration;
  return BattleCleanupManifestSchema.parse({
    version: 'battle_cleanup_manifest_v1',
    matchId: runtime.match.matchId,
    kind: orchestration ? 'arena_sparring' : 'standalone',
    ...(orchestration
      ? {
          roomId: orchestration.roomId,
          startRequestId: orchestration.startRequestId,
        }
      : {}),
    playerIds: [
      ...new Set(
        runtime.match.controllers.map((controller) => controller.playerId),
      ),
    ].sort(),
    cultivatorIds: [
      ...new Set(
        runtime.match.controllers.flatMap((controller) => controller.unitIds),
      ),
    ].sort(),
    createdAt: runtime.match.createdAt,
  });
}

function createStoredParticipants(runtime: OnlineBattleRuntimeStateV1) {
  const createdAt = new Date(runtime.match.createdAt).toISOString();
  const acceptedAt = new Date(runtime.match.updatedAt).toISOString();
  return runtime.match.controllers.map((controller) => {
    const accepted = runtime.acceptedPlayerIds.includes(controller.playerId);
    return {
      matchId: runtime.match.matchId,
      userId: controller.playerId,
      teamId: controller.teamId,
      cultivatorIds: [...controller.unitIds],
      status: accepted ? ('accepted' as const) : ('invited' as const),
      createdAt,
      ...(accepted ? { acceptedAt } : {}),
    };
  });
}

type StoredOnlineBattleParticipant = ReturnType<
  typeof createStoredParticipants
>[number];

function parseStoredParticipants(
  value: string,
): StoredOnlineBattleParticipant[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Online battle participants index is invalid');
  }
  for (const participant of parsed) {
    if (
      !participant ||
      typeof participant !== 'object' ||
      typeof participant.matchId !== 'string' ||
      typeof participant.userId !== 'string' ||
      typeof participant.teamId !== 'string' ||
      !Array.isArray(participant.cultivatorIds) ||
      !participant.cultivatorIds.every(
        (cultivatorId: unknown) => typeof cultivatorId === 'string',
      ) ||
      (participant.status !== 'invited' && participant.status !== 'accepted')
    ) {
      throw new Error('Online battle participants index is invalid');
    }
  }
  return parsed as StoredOnlineBattleParticipant[];
}

function assertStoredParticipants(
  value: string | null,
  runtime: OnlineBattleRuntimeStateV1,
): void {
  if (!value) throw new Error('Online battle participants index is missing');
  const actual = parseStoredParticipants(value)
    .map((participant) => ({
      matchId: participant.matchId,
      userId: participant.userId,
      teamId: participant.teamId,
      cultivatorIds: [...participant.cultivatorIds].sort(),
      status: participant.status,
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const expected = createStoredParticipants(runtime)
    .map((participant) => ({
      matchId: participant.matchId,
      userId: participant.userId,
      teamId: participant.teamId,
      cultivatorIds: [...participant.cultivatorIds].sort(),
      status: participant.status,
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Online battle participants index disagrees with runtime');
  }
}

function parseCleanupManifestOrFallback(
  value: string | null,
  matchId: string,
): BattleCleanupManifestV1 {
  if (value) {
    try {
      const parsed = BattleCleanupManifestSchema.safeParse(JSON.parse(value));
      if (parsed.success && parsed.data.matchId === matchId) return parsed.data;
    } catch {
      // Corrupt manifests fall back to the stable battle-to-room reverse index.
    }
  }
  return {
    version: 'battle_cleanup_manifest_v1',
    matchId,
    kind: 'standalone',
    playerIds: [],
    cultivatorIds: [],
    createdAt: Date.now(),
  };
}

function createTerminalEvent(
  input: Omit<BattleTerminalEventV1, 'version' | 'eventId'>,
): BattleTerminalEventV1 {
  return BattleTerminalEventSchema.parse({
    version: 'battle_terminal_event_v1',
    eventId: `${input.matchId}:terminal:${input.stateRevision}`,
    ...input,
  });
}

function commandReceiptField(
  record: Pick<OnlineBattleCommandReceiptRecordV1, 'playerId' | 'requestId'>,
): string {
  return JSON.stringify([record.playerId, record.requestId]);
}

function parseCommandReceipt(
  value: string,
  matchId: string,
  playerId: string,
  requestId: string,
): OnlineBattleCommandReceiptRecordV1 {
  const parsed = JSON.parse(
    value,
  ) as Partial<OnlineBattleCommandReceiptRecordV1>;
  if (
    parsed.playerId !== playerId ||
    parsed.requestId !== requestId ||
    (parsed.commandType !== 'round.submit' &&
      parsed.commandType !== 'presentation.ready') ||
    typeof parsed.payloadHash !== 'string' ||
    !parsed.receipt ||
    parsed.receipt.requestId !== requestId
  ) {
    throw new Error(`Stored battle command receipt is corrupt: ${matchId}`);
  }
  return parsed as OnlineBattleCommandReceiptRecordV1;
}

function nullableNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function arenaStartIndexKey(roomId: string, startRequestId: string): string {
  if (
    !/^[A-Za-z0-9_-]{1,120}$/.test(roomId) ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(startRequestId)
  ) {
    throw new Error('Invalid arena orchestration key');
  }
  return `battle:arena:start:${roomId}:${startRequestId}`;
}

function invitationKey(userId: string): string {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(userId)) {
    throw new Error('Invalid battle participant user id');
  }
  return `battle:invites:user:${userId}`;
}
