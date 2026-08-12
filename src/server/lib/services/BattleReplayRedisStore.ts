import { getRedisClient, redis } from '@server/lib/redis';
import {
  battleOnlineCommandReceiptsKey,
  battleOnlineMatchKey,
  battleReplayArchivePayloadKey,
  battleReplayRoundsKey,
} from './BattleOnlineRedisKeys';

export const BATTLE_REPLAY_ARCHIVE_PENDING_KEY =
  'battle:replay:archive:pending';
export const BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY =
  'battle:replay:archive:unconfirmed';
export const BATTLE_REPLAY_ARCHIVED_TTL_SECONDS = 30 * 60;
export const BATTLE_REPLAY_CONFIRM_TIMEOUT_MS = 2 * 60 * 1_000;

const MARK_ARCHIVED_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if tonumber(redis.call('HGET', KEYS[1], 'expected_storage_revision') or '-1') ~= tonumber(ARGV[4]) then return 0 end
redis.call('HSET', KEYS[1],
  'archive_status', 'archived',
  'archive_archived_at', ARGV[2])
redis.call('SREM', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
if redis.call('EXISTS', KEYS[4]) == 1 then redis.call('EXPIRE', KEYS[4], ARGV[3]) end
if redis.call('EXISTS', KEYS[5]) == 1 then redis.call('EXPIRE', KEYS[5], ARGV[3]) end
if redis.call('EXISTS', KEYS[6]) == 1 then redis.call('EXPIRE', KEYS[6], ARGV[3]) end
return 1
`;

const RECONCILE_ARCHIVE_TRACKING_LUA = `
if ARGV[2] == 'archived' then
  redis.call('SREM', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[1])
  return 3
end
if ARGV[2] == 'published' then
  redis.call('SREM', KEYS[1], ARGV[1])
  redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
  return 2
end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
return 1
`;

export interface StoredBattleReplayArchivePointer {
  readonly expectedStorageRevision: number;
  readonly archiveStatus: string | null;
  readonly publishAttempt: number;
  readonly publishedAt: number | null;
}

export async function getBattleReplayArchivePointer(
  matchId: string,
): Promise<StoredBattleReplayArchivePointer | null> {
  let revisionJson: string | null;
  let archiveStatus: string | null;
  let publishAttemptJson: string | null;
  let publishedAtJson: string | null;
  try {
    [revisionJson, archiveStatus, publishAttemptJson, publishedAtJson] =
      await redis.hmget(
        battleReplayArchivePayloadKey(matchId),
        'expected_storage_revision',
        'archive_status',
        'archive_publish_attempt',
        'archive_published_at',
      );
  } catch (error) {
    if (!isWrongTypeRedisError(error)) throw error;
    return repairBattleReplayArchivePointer(matchId, true);
  }
  if (!revisionJson) return repairBattleReplayArchivePointer(matchId);
  const expectedStorageRevision = Number(revisionJson);
  const publishAttempt = Number(publishAttemptJson ?? 0);
  const publishedAt = publishedAtJson === null ? null : Number(publishedAtJson);
  if (
    !Number.isSafeInteger(expectedStorageRevision) ||
    expectedStorageRevision < 0 ||
    !Number.isSafeInteger(publishAttempt) ||
    publishAttempt < 0 ||
    !['pending', 'published', 'archived'].includes(archiveStatus ?? '') ||
    (archiveStatus === 'published' &&
      (!Number.isFinite(publishedAt) ||
        publishedAt === null ||
        publishedAt < 0))
  ) {
    return repairBattleReplayArchivePointer(matchId);
  }
  return {
    expectedStorageRevision,
    archiveStatus,
    publishAttempt,
    publishedAt,
  };
}

export async function scanBattleReplayArchivePointerMatchIds(
  cursor = '0',
  count = 100,
): Promise<{ cursor: string; matchIds: string[] }> {
  const [nextCursor, keys] = await redis.scan(
    cursor,
    'MATCH',
    'battle:replay:archive:payload:*',
    'COUNT',
    count,
  );
  return {
    cursor: nextCursor,
    matchIds: keys.flatMap((key) => {
      const match =
        /^battle:replay:archive:payload:([A-Za-z0-9_-]{1,120})$/.exec(key);
      return match?.[1] ? [match[1]] : [];
    }),
  };
}

export async function reconcileBattleReplayArchiveTracking(
  matchId: string,
): Promise<void> {
  const pointer = await getBattleReplayArchivePointer(matchId);
  if (!pointer) return;
  await getRedisClient().eval(
    RECONCILE_ARCHIVE_TRACKING_LUA,
    2,
    BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
    BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
    matchId,
    pointer.archiveStatus ?? 'pending',
    String(pointer.publishedAt ?? 0),
  );
}

async function repairBattleReplayArchivePointer(
  matchId: string,
  replaceKey = false,
): Promise<StoredBattleReplayArchivePointer | null> {
  const [status, storageRevisionValue] = await redis.hmget(
    battleOnlineMatchKey(matchId),
    'status',
    'state_id',
  );
  const expectedStorageRevision = Number(storageRevisionValue);
  if (
    status !== 'finished' ||
    !Number.isSafeInteger(expectedStorageRevision) ||
    expectedStorageRevision < 0
  ) {
    await clearBattleReplayArchiveTracking(matchId);
    return null;
  }
  const transaction = redis.multi();
  if (replaceKey) transaction.del(battleReplayArchivePayloadKey(matchId));
  await transaction
    .hset(
      battleReplayArchivePayloadKey(matchId),
      'expected_storage_revision',
      String(expectedStorageRevision),
      'archive_status',
      'pending',
      'archive_publish_attempt',
      '0',
    )
    .sadd(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchId)
    .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchId)
    .exec();
  return {
    expectedStorageRevision,
    archiveStatus: 'pending',
    publishAttempt: 0,
    publishedAt: null,
  };
}

function isWrongTypeRedisError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('WRONGTYPE');
}

export async function markBattleReplayArchived(
  matchId: string,
  expectedStorageRevision: number,
  archivedAt = Date.now(),
): Promise<boolean> {
  return (
    Number(
      await getRedisClient().eval(
        MARK_ARCHIVED_LUA,
        6,
        battleReplayArchivePayloadKey(matchId),
        BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
        BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
        battleOnlineMatchKey(matchId),
        battleReplayRoundsKey(matchId),
        battleOnlineCommandReceiptsKey(matchId),
        matchId,
        String(archivedAt),
        String(BATTLE_REPLAY_ARCHIVED_TTL_SECONDS),
        String(expectedStorageRevision),
      ),
    ) === 1
  );
}

export async function clearBattleReplayArchiveTracking(
  matchId: string,
): Promise<void> {
  await redis
    .multi()
    .del(battleReplayArchivePayloadKey(matchId))
    .srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchId)
    .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchId)
    .exec();
}
