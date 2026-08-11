import type { Server, State, StorageAPI } from 'boardgame.io';
import type { BattleReplayV1 } from '@shared/contracts/battleReplay';
import type { BattleBlueprintV1 } from '@shared/engine/battle-v5/persistence/types';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import { ROUND_PLANNING_TIMEOUT_MS } from '@shared/engine/battle-v5/round/types';
import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';
import { getRedisClient, redis } from '@server/lib/redis';
import type { BattleBoardgameG } from './BattleBoardgameAdapter';
import {
  BATTLE_ONLINE_ALL_MATCHES_KEY,
  BATTLE_ONLINE_DEADLINES_KEY,
  BATTLE_ONLINE_RESOLVING_KEY,
  BATTLE_ONLINE_WAITING_KEY,
  battleOnlineMatchKey,
  battleReplayRoundsKey,
} from './BattleOnlineRedisKeys';
import {
  BATTLE_REPLAY_ARCHIVED_TTL_SECONDS,
  BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
  BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
  BATTLE_REPLAY_CONFIRM_TIMEOUT_MS,
  BATTLE_REPLAY_UNCONFIRMED_TTL_SECONDS,
} from './BattleReplayRedisStore';
import {
  completeBoardgamePresentation,
  failBoardgameResolution,
  resolveBoardgameTimeout,
  retryBoardgameResolution,
  resumeBoardgameResolution,
  technicalAbortBoardgameMatch,
} from './BattleBoardgameAdapter';

type StoredState = State<BattleBoardgameG>;

export type BattleBoardgamePlayerSessionV1 = BattleMatchSessionV1;

const ALL_MATCHES_KEY = BATTLE_ONLINE_ALL_MATCHES_KEY;
const DEADLINES_KEY = BATTLE_ONLINE_DEADLINES_KEY;
const RESOLVING_KEY = BATTLE_ONLINE_RESOLVING_KEY;
const WAITING_KEY = BATTLE_ONLINE_WAITING_KEY;
const MATCH_ACCEPT_TIMEOUT_MS = 10 * 60 * 1_000;
const ARENA_START_INDEX_TTL_SECONDS = 2 * 60 * 60;

const CREATE_MATCH_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if ARGV[9] ~= '' and redis.call('EXISTS', KEYS[6]) == 1 then return -1 end
redis.call('HSET', KEYS[1],
  'state_id', ARGV[1],
  'state', ARGV[2],
  'initial_state', ARGV[2],
  'blueprint', ARGV[11],
  'metadata', ARGV[3],
  'status', ARGV[4],
  'deadline_at', ARGV[5],
  'updated_at', ARGV[6])
redis.call('SADD', KEYS[4], ARGV[7])
if ARGV[5] ~= '' then redis.call('ZADD', KEYS[2], ARGV[5], ARGV[7]) end
  if ARGV[4] == 'resolving' then redis.call('SADD', KEYS[3], ARGV[7]) end
if ARGV[8] ~= '' then redis.call('ZADD', KEYS[5], ARGV[8], ARGV[7]) end
if ARGV[9] ~= '' then redis.call('SET', KEYS[6], ARGV[7], 'EX', ARGV[10]) end
return 1
`;

const SET_STATE_LUA = `
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -2 end
local currentNumber = tonumber(current)
local expected = tonumber(ARGV[1])
local incoming = tonumber(ARGV[2])
if incoming == currentNumber then
  local currentState = redis.call('HGET', KEYS[1], 'state')
  if currentState == ARGV[3] then return 2 end
  return -4
end
if incoming < currentNumber then return -1 end
if currentNumber ~= expected or incoming ~= currentNumber + 1 then return -1 end
redis.call('HSET', KEYS[1],
  'state_id', ARGV[2],
  'state', ARGV[3],
  'status', ARGV[4],
  'deadline_at', ARGV[5],
  'updated_at', ARGV[6])
redis.call('ZREM', KEYS[2], ARGV[7])
if ARGV[5] ~= '' then redis.call('ZADD', KEYS[2], ARGV[5], ARGV[7]) end
  redis.call('SREM', KEYS[3], ARGV[7])
  if ARGV[4] == 'resolving' then redis.call('SADD', KEYS[3], ARGV[7]) end
  redis.call('ZREM', KEYS[5], ARGV[7])
  if ARGV[8] ~= '' then
    redis.call('HSET', KEYS[1], 'archive', ARGV[8], 'archive_status', 'pending')
    redis.call('SADD', KEYS[6], ARGV[7])
  end
  if ARGV[9] ~= '' then redis.call('ZADD', KEYS[5], ARGV[9], ARGV[7]) end
  if ARGV[10] ~= '' then redis.call('RPUSH', KEYS[7], ARGV[10]) end
return 1
`;

const SET_METADATA_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], 'metadata', ARGV[1])
return 1
`;

const EXPIRE_WAITING_LUA = `
local deadline = redis.call('ZSCORE', KEYS[2], ARGV[1])
if not deadline or tonumber(deadline) > tonumber(ARGV[2]) then return 0 end
redis.call('DEL', KEYS[1], KEYS[7])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('SREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[4], ARGV[1])
redis.call('SREM', KEYS[5], ARGV[1])
redis.call('SREM', KEYS[6], ARGV[1])
return 1
`;

const RECONCILE_DEADLINE_LUA = `
local values = redis.call('HMGET', KEYS[1], 'state_id', 'deadline_at')
if not values[1] then return -2 end
local deadline = values[2] or ''
local indexed = redis.call('ZSCORE', KEYS[2], ARGV[1])
if deadline == '' then
  if not indexed then return 2 end
  redis.call('ZREM', KEYS[2], ARGV[1])
  return 1
end
if indexed and tonumber(indexed) == tonumber(deadline) then return 2 end
redis.call('ZADD', KEYS[2], deadline, ARGV[1])
return 1
`;

const MARK_ARCHIVE_PUBLISHED_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local status = redis.call('HGET', KEYS[1], 'archive_status')
local currentAttempt = tonumber(redis.call('HGET', KEYS[1], 'archive_publish_attempt') or '0')
local incomingAttempt = tonumber(ARGV[4])
if status == 'archived' then
  redis.call('SREM', KEYS[3], ARGV[1])
  redis.call('ZREM', KEYS[4], ARGV[1])
  redis.call('SREM', KEYS[5], ARGV[1])
  redis.call('ZREM', KEYS[6], ARGV[1])
  redis.call('SREM', KEYS[7], ARGV[1])
  return 2
end
if status ~= 'pending' and status ~= 'published' then return -1 end
if incomingAttempt < currentAttempt then return 3 end
redis.call('HSET', KEYS[1],
  'archive_status', 'published',
  'archive_published_at', ARGV[2],
  'archive_publish_attempt', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[3])
redis.call('SREM', KEYS[3], ARGV[1])
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[1])
redis.call('SREM', KEYS[5], ARGV[1])
redis.call('ZREM', KEYS[6], ARGV[1])
redis.call('SREM', KEYS[7], ARGV[1])
return 1
`;

export { battleOnlineMatchKey } from './BattleOnlineRedisKeys';

/** Redis is the only authority for an in-progress boardgame.io match. */
export class RedisBattleBoardgameStorage implements StorageAPI.Async {
  private readonly blueprintCache = new Map<string, BattleBlueprintV1>();
  private archivePendingListener: (() => void) | undefined;

  setArchivePendingListener(listener: (() => void) | undefined): void {
    this.archivePendingListener = listener;
  }

  type(): 1 {
    return 1;
  }

  async connect(): Promise<void> {
    await redis.ping();
  }

  async hasMatch(matchID: string): Promise<boolean> {
    return (await redis.exists(battleOnlineMatchKey(matchID))) === 1;
  }

  async getPlayerSession(
    matchID: string,
    applicationPlayerId: string,
  ): Promise<BattleBoardgamePlayerSessionV1 | null> {
    const [stateJson, metadataJson] = await redis.hmget(
      battleOnlineMatchKey(matchID),
      'state',
      'metadata',
    );
    if (!stateJson || !metadataJson) return null;
    const state = parseStoredStateEnvelope(stateJson, matchID);
    const boardgameId = Object.entries(state.G.playerIdByBoardgameId).find(
      ([, playerId]) => playerId === applicationPlayerId,
    )?.[0];
    if (!boardgameId) return null;
    const metadata = JSON.parse(metadataJson) as Server.MatchData;
    const playerIndex = Number(boardgameId);
    if (!Number.isSafeInteger(playerIndex) || playerIndex < 0) return null;
    const player = metadata.players?.[playerIndex];
    if (!player?.name || typeof player.credentials !== 'string') return null;
    return {
      gameName: 'battle-v5-match',
      matchID,
      playerID: boardgameId,
      playerCredentials: player.credentials,
      serverOrigin: process.env.BATTLE_SERVER_PUBLIC_ORIGIN ?? 'http://localhost:3100',
    };
  }

  async createMatch(
    matchID: string,
    opts: StorageAPI.CreateMatchOpts,
  ): Promise<void> {
    const state = normalizeBoardgameState(matchID, opts.initialState as StoredState);
    const deadlineAt = indexedDeadline(state.G);
    const acceptDeadlineAt = indexedAcceptDeadline(state.G);
    const storedState = stripImmutableBattleData(stripPendingReplayRound(state));
    const orchestration = arenaOrchestrationFromMetadata(opts.metadata);
    const storedMetadata = stripSetupData(opts.metadata);
    const orchestrationKey = orchestration
      ? arenaStartIndexKey(orchestration.roomId, orchestration.startRequestId)
      : `battle:online:arena-start-disabled:${matchID}`;
    const result = Number(await getRedisClient().eval(
      CREATE_MATCH_LUA,
      6,
      battleOnlineMatchKey(matchID),
      DEADLINES_KEY,
      RESOLVING_KEY,
      ALL_MATCHES_KEY,
      WAITING_KEY,
      orchestrationKey,
      String(state._stateID),
      JSON.stringify(storedState),
      JSON.stringify(storedMetadata),
      state.G.status,
      deadlineAt === null ? '' : String(deadlineAt),
      String(state.G.updatedAt),
      matchID,
      acceptDeadlineAt === null ? '' : String(acceptDeadlineAt),
      orchestration ? '1' : '',
      String(ARENA_START_INDEX_TTL_SECONDS),
      JSON.stringify(state.G.battle.blueprint),
    ));
    if (result === -1) {
      throw new Error(`Battle arena orchestration already exists: ${matchID}`);
    }
    if (result !== 1) throw new Error(`Battle boardgame match already exists: ${matchID}`);
    this.cacheBlueprint(matchID, state.G.battle.blueprint);
  }

  async findArenaMatch(roomId: string, startRequestId: string): Promise<string | null> {
    const key = arenaStartIndexKey(roomId, startRequestId);
    const matchID = await redis.get(key);
    if (!matchID) return null;
    if ((await redis.exists(battleOnlineMatchKey(matchID))) === 1) return matchID;
    await redis.del(key);
    return null;
  }

  async setState(
    matchID: string,
    state: State,
  ): Promise<void> {
    const updated = await this.compareAndSetState(matchID, state as StoredState);
    if (!updated) throw new BattleBoardgameStateConflictError(matchID);
  }

  async setMetadata(matchID: string, metadata: Server.MatchData): Promise<void> {
    const updated = Number(await getRedisClient().eval(
      SET_METADATA_LUA,
      1,
      battleOnlineMatchKey(matchID),
      JSON.stringify(stripSetupData(metadata)),
    ));
    if (updated !== 1) throw new Error(`Unknown boardgame match: ${matchID}`);
  }

  async acceptPlayer(matchID: string, playerID: string, now = Date.now()): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const fetched = await this.fetch(matchID, { state: true });
      const current = fetched.state as StoredState;
      if (!current.G.playerIdByBoardgameId[playerID]) throw new Error('Unknown battle player slot');
      const accepted = current.G.acceptedBoardgamePlayerIds;
      if (accepted.includes(playerID)) return false;
      const acceptedBoardgamePlayerIds = [...accepted, playerID].sort();
      const allAccepted = acceptedBoardgamePlayerIds.length === current.G.controllers.length;
      const next: StoredState = {
        ...current,
        G: {
          ...current.G,
          acceptedBoardgamePlayerIds,
          planning: current.G.planning && allAccepted
            ? { ...current.G.planning, deadlineAt: now + ROUND_PLANNING_TIMEOUT_MS }
            : current.G.planning,
          revision: allAccepted ? current.G.revision + 1 : current.G.revision,
          updatedAt: allAccepted ? now : current.G.updatedAt,
        },
        _stateID: current._stateID + 1,
      };
      if (await this.compareAndSetState(matchID, next)) return true;
    }
    throw new Error('Battle boardgame accept conflict');
  }

  async fetch<O extends StorageAPI.FetchOpts>(
    matchID: string,
    opts: O,
  ): Promise<StorageAPI.FetchResult<O>> {
    const key = battleOnlineMatchKey(matchID);
    const requestedFields: string[] = [];
    if (opts.state) requestedFields.push('state');
    if (opts.initialState) requestedFields.push('initial_state');
    if (opts.metadata) requestedFields.push('metadata');
    const needsBlueprint = Boolean(opts.state || opts.initialState);
    const cachedBlueprint = needsBlueprint ? this.blueprintCache.get(matchID) : undefined;
    const [exists, fields, blueprintJson] = await Promise.all([
      redis.exists(key),
      requestedFields.length > 0 ? redis.hmget(key, ...requestedFields) : Promise.resolve([]),
      needsBlueprint && !cachedBlueprint ? redis.hget(key, 'blueprint') : Promise.resolve(null),
    ]);
    if (exists !== 1) throw new Error(`Unknown boardgame match: ${matchID}`);
    const values = new Map(requestedFields.map((field, index) => [field, fields[index]]));
    const result: Record<string, unknown> = {};
    const stateJson = values.get('state');
    const initialStateJson = values.get('initial_state');
    const metadataJson = values.get('metadata');
    const storedBlueprint = cachedBlueprint ?? parseBlueprint(blueprintJson, matchID);
    const hydratedState = stateJson
      ? normalizeReplayAccumulator(this.hydrateState(stateJson, matchID, storedBlueprint))
      : undefined;
    const hydratedInitialState = initialStateJson
      ? normalizeReplayAccumulator(this.hydrateState(initialStateJson, matchID, storedBlueprint))
      : undefined;
    if (opts.state) result.state = hydratedState;
    if (opts.initialState) result.initialState = hydratedInitialState;
    if (opts.metadata) result.metadata = metadataJson ? JSON.parse(metadataJson) : {};
    const legacyBlueprint = hydratedState?.G.battle.blueprint ??
      hydratedInitialState?.G.battle.blueprint;
    if (needsBlueprint && !cachedBlueprint && !blueprintJson && legacyBlueprint) {
      await redis.hsetnx(key, 'blueprint', JSON.stringify(legacyBlueprint));
    }
    // boardgame.io internal move logs are intentionally not persisted.
    if (opts.log) result.log = [];
    return result as StorageAPI.FetchResult<O>;
  }

  async wipe(matchID: string): Promise<void> {
    const [participantsJson, stateJson] = await redis.hmget(
      battleOnlineMatchKey(matchID),
      'participants',
      'state',
    );
    const invitedUserIds = participantsJson
      ? parseInvitationUserIds(participantsJson)
      : stateJson
        ? parseInvitationUserIdsFromState(stateJson)
        : [];
    const transaction = redis.multi()
      .del(battleOnlineMatchKey(matchID))
      .del(battleReplayRoundsKey(matchID))
      .srem(ALL_MATCHES_KEY, matchID)
      .zrem(DEADLINES_KEY, matchID)
      .zrem(WAITING_KEY, matchID)
      .srem(RESOLVING_KEY, matchID)
      .srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchID)
      .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchID);
    for (const userId of invitedUserIds) transaction.zrem(`battle:invites:user:${userId}`, matchID);
    await transaction.exec();
    this.blueprintCache.delete(matchID);
  }

  async listMatches(): Promise<string[]> {
    return redis.smembers(ALL_MATCHES_KEY);
  }

  async scanMatchIds(
    cursor = '0',
    count = 100,
  ): Promise<{ cursor: string; matchIds: string[] }> {
    if (!/^\d+$/.test(cursor) || !Number.isSafeInteger(count) || count < 1) {
      throw new Error('Invalid battle match scan options');
    }
    const [nextCursor, matchIds] = await redis.sscan(
      ALL_MATCHES_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async listExpiredMatchIds(now = Date.now(), limit = 100): Promise<string[]> {
    return redis.zrangebyscore(DEADLINES_KEY, 0, now, 'LIMIT', 0, limit);
  }

  async scanResolvingMatchIds(
    cursor = '0',
    count = 100,
  ): Promise<{ cursor: string; matchIds: string[] }> {
    if (!/^\d+$/.test(cursor) || !Number.isSafeInteger(count) || count < 1) {
      throw new Error('Invalid resolving battle match scan options');
    }
    const [nextCursor, matchIds] = await redis.sscan(
      RESOLVING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async listExpiredWaitingMatchIds(now = Date.now(), limit = 100): Promise<string[]> {
    return redis.zrangebyscore(WAITING_KEY, 0, now, 'LIMIT', 0, limit);
  }

  async expireWaiting(matchID: string, now = Date.now()): Promise<boolean> {
    const [participantsJson, stateJson] = await redis.hmget(
      battleOnlineMatchKey(matchID), 'participants', 'state',
    );
    const invitedUserIds = participantsJson
      ? parseInvitationUserIds(participantsJson)
      : stateJson
        ? parseInvitationUserIdsFromState(stateJson)
        : [];
    const expired = Number(await getRedisClient().eval(
      EXPIRE_WAITING_LUA,
      7,
      battleOnlineMatchKey(matchID),
      WAITING_KEY,
      ALL_MATCHES_KEY,
      DEADLINES_KEY,
      RESOLVING_KEY,
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      battleReplayRoundsKey(matchID),
      matchID,
      String(now),
    ));
    if (expired !== 1) return false;
    this.blueprintCache.delete(matchID);
    if (invitedUserIds.length > 0) {
      const transaction = redis.multi();
      for (const userId of invitedUserIds) {
        transaction.zrem(`battle:invites:user:${userId}`, matchID);
      }
      await transaction.exec();
    }
    return true;
  }

  async scanPendingArchiveMatchIds(
    cursor = '0',
    count = 100,
  ): Promise<{ cursor: string; matchIds: string[] }> {
    if (!/^\d+$/.test(cursor) || !Number.isSafeInteger(count) || count < 1) {
      throw new Error('Invalid battle replay archive scan options');
    }
    const [nextCursor, matchIds] = await redis.sscan(
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      cursor,
      'COUNT',
      count,
    );
    return { cursor: nextCursor, matchIds };
  }

  async listUnconfirmedArchiveMatchIds(
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

  async getPendingArchive(matchID: string): Promise<BattleReplayV1 | null> {
    const payload = await redis.hget(battleOnlineMatchKey(matchID), 'archive');
    return payload ? JSON.parse(payload) as BattleReplayV1 : null;
  }

  async markArchivePublished(matchID: string, attempt: number): Promise<void> {
    if (!Number.isSafeInteger(attempt) || attempt < 1) {
      throw new Error('Battle replay archive attempt must be a positive integer');
    }
    const publishedAt = Date.now();
    const result = Number(await getRedisClient().eval(
      MARK_ARCHIVE_PUBLISHED_LUA,
      7,
      battleOnlineMatchKey(matchID),
      battleReplayRoundsKey(matchID),
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
      ALL_MATCHES_KEY,
      DEADLINES_KEY,
      RESOLVING_KEY,
      matchID,
      String(publishedAt),
      String(BATTLE_REPLAY_UNCONFIRMED_TTL_SECONDS),
      String(attempt),
    ));
    if (result === 1 || result === 2 || result === 3) return;
    if (result === 0) throw new Error(`Unknown boardgame match: ${matchID}`);
    if (result === -1) throw new Error(`Battle replay archive state conflict: ${matchID}`);
    throw new Error(`Unexpected battle archive publish result: ${result}`);
  }

  async resolveExpired(matchID: string, now = Date.now()): Promise<boolean> {
    const fetched = await this.fetch(matchID, { state: true });
    const current = fetched.state as StoredState;
    if (current.G.presentation) {
      if (current.G.presentation.endsAt > now) {
        await this.reconcileDeadlineIndexEntry(matchID);
        return false;
      }
      const next = completeBoardgamePresentation(current.G, now);
      return this.compareAndSetState(matchID, withGameState(current, next));
    }
    if (
      current.G.status !== 'planning' ||
      !current.G.planning ||
      current.G.planning.deadlineAt > now
    ) {
      await this.reconcileDeadlineIndexEntry(matchID);
      return false;
    }
    const next = resolveBoardgameTimeout(current.G, now);
    if (next === current.G) return false;
    return this.compareAndSetState(matchID, withGameState(current, next));
  }

  async reconcileDeadlineIndex(matchID: string): Promise<boolean> {
    return this.reconcileDeadlineIndexEntry(matchID);
  }

  async resumeResolving(matchID: string, now = Date.now()): Promise<boolean> {
    const fetched = await this.fetch(matchID, { state: true });
    const current = fetched.state as StoredState;
    if (current.G.status !== 'resolving' || !current.G.resolving) {
      await redis.srem(RESOLVING_KEY, matchID);
      return false;
    }
    let next: BattleBoardgameG;
    try {
      next = resumeBoardgameResolution(current.G, now);
    } catch (error) {
      next = failBoardgameResolution(current.G, error, now);
      console.error('[battle-storage] deterministic round resolution failed', {
        matchId: matchID,
        round: current.G.resolving.commandSet.round,
        commandSetId: current.G.resolving.commandSet.commandSetId,
        checkpointRevision: current.G.battle.checkpoint.checkpointRevision,
        fingerprint: next.resolving?.failure?.fingerprint,
      });
    }
    return this.compareAndSetState(matchID, withGameState(current, next));
  }

  async retryResolution(matchID: string, now = Date.now()): Promise<boolean> {
    const fetched = await this.fetch(matchID, { state: true });
    const current = fetched.state as StoredState;
    const next = retryBoardgameResolution(current.G, now);
    if (next === current.G) return false;
    return this.compareAndSetState(matchID, withGameState(current, next));
  }

  async technicalAbort(matchID: string, now = Date.now()): Promise<boolean> {
    const fetched = await this.fetch(matchID, { state: true });
    const current = fetched.state as StoredState;
    const next = technicalAbortBoardgameMatch(current.G, now);
    if (next === current.G) return false;
    const updated = await this.compareAndSetState(matchID, withGameState(current, next));
    if (!updated) return false;
    await redis
      .multi()
      .expire(battleOnlineMatchKey(matchID), BATTLE_REPLAY_ARCHIVED_TTL_SECONDS)
      .expire(battleReplayRoundsKey(matchID), BATTLE_REPLAY_ARCHIVED_TTL_SECONDS)
      .srem(ALL_MATCHES_KEY, matchID)
      .zrem(DEADLINES_KEY, matchID)
      .zrem(WAITING_KEY, matchID)
      .srem(RESOLVING_KEY, matchID)
      .srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchID)
      .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchID)
      .exec();
    return true;
  }

  private async compareAndSetState(matchID: string, state: StoredState): Promise<boolean> {
    if (state.G.matchId !== matchID) throw new Error('Boardgame match id does not match battle state');
    if (state._stateID < 1) {
      throw new Error('Battle boardgame state id conflict');
    }
    const shouldArchive = state.G.status === 'finished' && !state.G.presentation;
    const [initialStateJson, storedRoundJson] = await Promise.all([
      shouldArchive
        ? redis.hget(battleOnlineMatchKey(matchID), 'initial_state')
        : Promise.resolve(null),
      shouldArchive
        ? redis.lrange(battleReplayRoundsKey(matchID), 0, -1)
        : Promise.resolve([]),
    ]);
    const deadlineAt = indexedDeadline(state.G);
    const acceptDeadlineAt = indexedAcceptDeadline(state.G);
    const storedState = stripImmutableBattleData(stripPendingReplayRound(state));
    const pendingRound = state.G.replay.pendingRound;
    const replayRound = pendingRound ? JSON.stringify(pendingRound) : '';
    let archive: BattleReplayV1 | null = null;
    if (shouldArchive) {
      if (!initialStateJson) throw new Error(`Unknown boardgame match: ${matchID}`);
      const rounds = storedRoundJson.map(parseReplayRound);
      if (
        pendingRound &&
        !rounds.some((round) =>
          round.commandSet.commandSetId === pendingRound.commandSet.commandSetId)
      ) {
        rounds.push(pendingRound);
      }
      archive = buildReplay(
        state.G,
        parseState(initialStateJson, matchID, state.G.battle.blueprint).G.battle,
        rounds,
      );
    }
    const result = Number(await getRedisClient().eval(
      SET_STATE_LUA,
      7,
      battleOnlineMatchKey(matchID),
      DEADLINES_KEY,
      RESOLVING_KEY,
      ALL_MATCHES_KEY,
      WAITING_KEY,
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      battleReplayRoundsKey(matchID),
      String(state._stateID - 1),
      String(state._stateID),
      JSON.stringify(storedState),
      state.G.status,
      deadlineAt === null ? '' : String(deadlineAt),
      String(state.G.updatedAt),
      matchID,
      archive ? JSON.stringify(archive) : '',
      acceptDeadlineAt === null ? '' : String(acceptDeadlineAt),
      replayRound,
    ));
    if (result === 1) {
      if (archive) this.archivePendingListener?.();
      return true;
    }
    // boardgame.io persists the unchanged state after INVALID_MOVE. Treat only
    // byte-identical, equal-stateID writes as a successful idempotent no-op.
    if (result === 2) return true;
    if (result === -2) throw new Error(`Unknown boardgame match: ${matchID}`);
    if (result === -1 || result === -4) return false;
    throw new Error(`Unexpected battle boardgame CAS result: ${result}`);
  }

  private async reconcileDeadlineIndexEntry(matchID: string): Promise<boolean> {
    const result = Number(await getRedisClient().eval(
      RECONCILE_DEADLINE_LUA,
      2,
      battleOnlineMatchKey(matchID),
      DEADLINES_KEY,
      matchID,
    ));
    if (result === 1) return true;
    if (result === 0 || result === 2) return false;
    if (result === -2) throw new Error(`Unknown boardgame match: ${matchID}`);
    throw new Error(`Unexpected battle deadline reconciliation result: ${result}`);
  }

  private hydrateState(
    stateJson: string,
    matchID: string,
    storedBlueprint: BattleBlueprintV1 | null,
  ): StoredState {
    const state = parseState(stateJson, matchID, storedBlueprint ?? undefined);
    this.cacheBlueprint(matchID, state.G.battle.blueprint);
    return state;
  }

  private cacheBlueprint(matchID: string, blueprint: BattleBlueprintV1): void {
    this.blueprintCache.delete(matchID);
    this.blueprintCache.set(matchID, blueprint);
    if (this.blueprintCache.size > 128) {
      const oldest = this.blueprintCache.keys().next().value;
      if (oldest) this.blueprintCache.delete(oldest);
    }
  }
}

export class BattleBoardgameStateConflictError extends Error {
  readonly code = 'BATTLE_BOARDGAME_STATE_CONFLICT';

  constructor(readonly matchID: string) {
    super(`Battle boardgame state conflict: ${matchID}`);
    this.name = 'BattleBoardgameStateConflictError';
  }
}

function indexedDeadline(G: BattleBoardgameG): number | null {
  const allAccepted = G.acceptedBoardgamePlayerIds.length === G.controllers.length;
  if (G.presentation) return G.presentation.endsAt;
  return G.status === 'planning' && G.planning && allAccepted
    ? G.planning.deadlineAt
    : null;
}

function indexedAcceptDeadline(G: BattleBoardgameG): number | null {
  return G.status === 'planning' &&
    G.acceptedBoardgamePlayerIds.length < G.controllers.length
    ? G.createdAt + MATCH_ACCEPT_TIMEOUT_MS
    : null;
}

function stripPendingReplayRound(state: StoredState): StoredState {
  return {
    ...state,
    G: {
      ...state.G,
      replay: { version: 'battle_replay_accumulator_v1' },
    },
  };
}

function stripImmutableBattleData(state: StoredState): StoredState {
  const mutableBattle = { ...state.G.battle } as Partial<StoredState['G']['battle']>;
  delete mutableBattle.blueprint;
  return {
    ...state,
    G: {
      ...state.G,
      battle: mutableBattle as StoredState['G']['battle'],
    },
  };
}

function normalizeReplayAccumulator(state: StoredState): StoredState {
  return {
    ...state,
    G: {
      ...state.G,
      replay: {
        version: 'battle_replay_accumulator_v1',
      },
    },
  };
}

function parseInvitationUserIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as Array<{ userId?: unknown; status?: unknown }>;
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry.status === 'invited' && typeof entry.userId === 'string')
        .map((entry) => entry.userId as string)
      : [];
  } catch {
    return [];
  }
}

function parseInvitationUserIdsFromState(value: string): string[] {
  try {
    const state = JSON.parse(value) as StoredState;
    return Object.entries(state.G.playerIdByBoardgameId)
      .filter(([boardgamePlayerId]) =>
        !state.G.acceptedBoardgamePlayerIds.includes(boardgamePlayerId),
      )
      .map(([, applicationPlayerId]) => applicationPlayerId);
  } catch {
    return [];
  }
}

function withGameState(current: StoredState, G: BattleBoardgameG): StoredState {
  return {
    ...current,
    G,
    _stateID: current._stateID + 1,
    ctx: G.status === 'finished' && !G.presentation
      ? { ...current.ctx, gameover: { result: G.latestResolution?.outcome } }
      : G.status === 'cancelled'
        ? { ...current.ctx, gameover: { cancelled: true } }
        : current.ctx,
  };
}

function buildReplay(
  G: BattleBoardgameG,
  initialBattle: BattleBoardgameG['battle'],
  rounds: readonly BattleReplayV1['rounds'][number][],
): BattleReplayV1 {
  const outcome = G.latestResolution?.outcome;
  if (!outcome?.battleEnded || rounds.length === 0) {
    throw new Error('Finished battle is missing replay material');
  }
  return {
    version: 'battle_replay_v1',
    matchId: G.matchId,
    engineVersion: 'battle-v5',
    rulesetVersion: 'team-sync-round-v1',
    startedAt: G.createdAt,
    finishedAt: G.updatedAt,
    participants: G.controllers,
    initialBattle,
    rounds,
    finalSnapshot: createBattlePublicSnapshot(G.battle),
    outcome,
  };
}

function parseReplayRound(value: string): BattleReplayV1['rounds'][number] {
  return JSON.parse(value) as BattleReplayV1['rounds'][number];
}

function parseState(
  value: string,
  matchID: string,
  storedBlueprint?: BattleBlueprintV1,
): StoredState {
  const state = parseStoredStateEnvelope(value, matchID);
  const blueprint = storedBlueprint ?? state.G.battle.blueprint;
  if (!blueprint || blueprint.version !== 'battle_blueprint_v1' || blueprint.battleId !== matchID) {
    throw new Error('Invalid stored boardgame battle blueprint');
  }
  return {
    ...state,
    G: {
      ...state.G,
      battle: {
        ...state.G.battle,
        blueprint,
      },
    },
  };
}

function parseStoredStateEnvelope(value: string, matchID: string): StoredState {
  const state = JSON.parse(value) as StoredState;
  if (state.G.matchId !== matchID || state.G.version !== 'battle_match_state_v1') {
    throw new Error('Invalid stored boardgame battle state');
  }
  return state;
}

function parseBlueprint(value: string | null, matchID: string): BattleBlueprintV1 | null {
  if (!value) return null;
  const blueprint = JSON.parse(value) as BattleBlueprintV1;
  if (blueprint.version !== 'battle_blueprint_v1' || blueprint.battleId !== matchID) {
    throw new Error('Invalid stored boardgame battle blueprint');
  }
  return blueprint;
}

function normalizeBoardgameState(matchID: string, state: StoredState): StoredState {
  if (!matchID || state.G.version !== 'battle_match_state_v1') {
    throw new Error('Invalid boardgame battle state');
  }
  const battle = normalizeBattleSaveId(state.G.battle, matchID);
  return {
    ...state,
    G: {
      ...state.G,
      matchId: matchID,
      battle,
    },
  };
}

function normalizeBattleSaveId(
  battle: BattleBoardgameG['battle'],
  battleId: string,
) {
  return {
    ...battle,
    blueprint: { ...battle.blueprint, battleId },
    checkpoint: { ...battle.checkpoint, battleId },
  };
}

function arenaOrchestrationFromMetadata(metadata: Server.MatchData | undefined) {
  const value = (metadata as { setupData?: unknown } | undefined)?.setupData;
  if (!value || typeof value !== 'object') return null;
  const orchestration = (value as { orchestration?: unknown }).orchestration;
  if (!orchestration || typeof orchestration !== 'object') return null;
  const parsed = orchestration as {
    kind?: unknown;
    roomId?: unknown;
    startRequestId?: unknown;
  };
  if (
    parsed.kind !== 'arena_sparring_v1' ||
    typeof parsed.roomId !== 'string' ||
    typeof parsed.startRequestId !== 'string'
  ) return null;
  return {
    roomId: parsed.roomId,
    startRequestId: parsed.startRequestId,
  };
}

function stripSetupData(metadata: Server.MatchData | undefined): Server.MatchData {
  const storedMetadata = { ...(metadata ?? {}) } as Server.MatchData & {
    setupData?: unknown;
  };
  delete storedMetadata.setupData;
  return storedMetadata;
}

function arenaStartIndexKey(roomId: string, startRequestId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(roomId) || !/^[A-Za-z0-9_-]{1,120}$/.test(startRequestId)) {
    throw new Error('Invalid arena orchestration key');
  }
  return `battle:arena:start:${roomId}:${startRequestId}`;
}
