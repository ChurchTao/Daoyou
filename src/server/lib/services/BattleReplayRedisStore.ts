import { getRedisClient, redis } from '@server/lib/redis';
import {
  parseBattleReplay,
  type BattleReplayV1,
} from '@shared/contracts/battleReplay';
import { createHash } from 'node:crypto';
import {
  BATTLE_ONLINE_ALL_MATCHES_KEY,
  BATTLE_ONLINE_DEADLINES_KEY,
  BATTLE_ONLINE_RESOLVING_KEY,
  BATTLE_ONLINE_WAITING_KEY,
  battleOnlineMatchKey,
  battleReplayRoundsKey,
} from './BattleOnlineRedisKeys';

export const BATTLE_REPLAY_ARCHIVE_PENDING_KEY = 'battle:replay:archive:pending';
export const BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY =
  'battle:replay:archive:unconfirmed';
export const BATTLE_REPLAY_UNCONFIRMED_TTL_SECONDS = 24 * 60 * 60;
export const BATTLE_REPLAY_ARCHIVED_TTL_SECONDS = 30 * 60;
export const BATTLE_REPLAY_CONFIRM_TIMEOUT_MS = 2 * 60 * 1_000;

const MARK_ARCHIVED_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1],
  'archive_status', 'archived',
  'archive_archived_at', ARGV[2])
redis.call('SREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[4], ARGV[1])
redis.call('SREM', KEYS[5], ARGV[1])
redis.call('ZREM', KEYS[6], ARGV[1])
redis.call('ZREM', KEYS[7], ARGV[1])
redis.call('SREM', KEYS[8], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 1
`;

export interface StoredBattleReplayArchivePayload {
  readonly replay: BattleReplayV1;
  readonly archiveStatus: string | null;
  readonly publishAttempt: number;
  readonly byteLength: number;
  readonly checksum: string;
}

export async function getBattleReplayArchivePayload(
  matchId: string,
): Promise<StoredBattleReplayArchivePayload | null> {
  const [payload, archiveStatus, publishAttemptJson] = await redis.hmget(
    battleOnlineMatchKey(matchId),
    'archive',
    'archive_status',
    'archive_publish_attempt',
  );
  if (!payload) return null;
  const bytes = Buffer.from(payload, 'utf8');
  const publishAttempt = Number(publishAttemptJson ?? 0);
  if (!Number.isSafeInteger(publishAttempt) || publishAttempt < 0) {
    throw new Error(`Invalid battle replay archive attempt: ${matchId}`);
  }
  return {
    replay: parseBattleReplay(JSON.parse(payload)),
    archiveStatus,
    publishAttempt,
    byteLength: bytes.byteLength,
    checksum: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function markBattleReplayArchived(
  matchId: string,
  archivedAt = Date.now(),
): Promise<boolean> {
  return Number(await getRedisClient().eval(
    MARK_ARCHIVED_LUA,
    8,
    battleOnlineMatchKey(matchId),
    battleReplayRoundsKey(matchId),
    BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
    BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
    BATTLE_ONLINE_ALL_MATCHES_KEY,
    BATTLE_ONLINE_DEADLINES_KEY,
    BATTLE_ONLINE_WAITING_KEY,
    BATTLE_ONLINE_RESOLVING_KEY,
    matchId,
    String(archivedAt),
    String(BATTLE_REPLAY_ARCHIVED_TTL_SECONDS),
  )) === 1;
}

export async function clearBattleReplayArchiveTracking(matchId: string): Promise<void> {
  await redis
    .multi()
    .srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchId)
    .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchId)
    .exec();
}
