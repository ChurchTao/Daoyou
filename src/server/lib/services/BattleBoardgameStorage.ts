import type { Server, State, StorageAPI } from 'boardgame.io';
import type { BattleReplayV1 } from '@shared/contracts/battleReplay';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import { ROUND_PLANNING_TIMEOUT_MS } from '@shared/engine/battle-v5/round/types';
import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';
import { getRedisClient, redis } from '@server/lib/redis';
import type { BattleBoardgameG } from './BattleBoardgameAdapter';
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

const MATCH_PREFIX = 'battle:online:';
const ALL_MATCHES_KEY = 'battle:online:matches';
const DEADLINES_KEY = 'battle:online:deadlines';
const RESOLVING_KEY = 'battle:online:resolving';
const WAITING_KEY = 'battle:online:waiting';
const ARCHIVE_PENDING_KEY = 'battle:replay:archive:pending';
const ARCHIVED_MATCH_TTL_SECONDS = 30 * 60;
const MATCH_ACCEPT_TIMEOUT_MS = 10 * 60 * 1_000;
const ARENA_START_INDEX_TTL_SECONDS = 2 * 60 * 60;

const CREATE_MATCH_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if ARGV[9] ~= '' and redis.call('EXISTS', KEYS[6]) == 1 then return -1 end
redis.call('HSET', KEYS[1],
  'state_id', ARGV[1],
  'state', ARGV[2],
  'initial_state', ARGV[2],
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
if redis.call('LLEN', KEYS[7]) ~= tonumber(ARGV[11]) then return -3 end
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
local current = redis.call('HGET', KEYS[1], 'state_id')
if not current then return -2 end
if current ~= ARGV[1] then return 0 end
local indexed = redis.call('ZSCORE', KEYS[2], ARGV[2])
if ARGV[3] == '' then
  if not indexed then return 2 end
  redis.call('ZREM', KEYS[2], ARGV[2])
  return 1
end
if indexed and tonumber(indexed) == tonumber(ARGV[3]) then return 2 end
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[2])
return 1
`;

export function battleOnlineMatchKey(matchID: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(matchID)) {
    throw new Error('Invalid battle match id');
  }
  return `${MATCH_PREFIX}${matchID}`;
}

function replayRoundsKey(matchID: string): string {
  return `${battleOnlineMatchKey(matchID)}:replay-rounds`;
}

/** Redis is the only authority for an in-progress boardgame.io match. */
export class RedisBattleBoardgameStorage implements StorageAPI.Async {
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
    const state = parseState(stateJson, matchID);
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
    const storedState = stripReplayRounds(state);
    const orchestration = arenaOrchestrationFromMetadata(opts.metadata);
    const orchestrationKey = orchestration
      ? arenaStartIndexKey(orchestration.roomId, orchestration.startRequestId)
      : `${MATCH_PREFIX}arena-start-disabled:${matchID}`;
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
      JSON.stringify(opts.metadata ?? {}),
      state.G.status,
      deadlineAt === null ? '' : String(deadlineAt),
      String(state.G.updatedAt),
      matchID,
      acceptDeadlineAt === null ? '' : String(acceptDeadlineAt),
      orchestration ? '1' : '',
      String(ARENA_START_INDEX_TTL_SECONDS),
    ));
    if (result === -1) {
      throw new Error(`Battle arena orchestration already exists: ${matchID}`);
    }
    if (result !== 1) throw new Error(`Battle boardgame match already exists: ${matchID}`);
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
      JSON.stringify(metadata),
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
    const [fields, replayRounds] = await Promise.all([
      redis.hmget(battleOnlineMatchKey(matchID), 'state', 'initial_state', 'metadata'),
      redis.lrange(replayRoundsKey(matchID), 0, -1),
    ]);
    if (!fields[0]) throw new Error(`Unknown boardgame match: ${matchID}`);
    const result: Record<string, unknown> = {};
    if (opts.state) result.state = hydrateReplay(parseState(fields[0], matchID), replayRounds);
    if (opts.initialState) result.initialState = fields[1]
      ? hydrateReplay(parseState(fields[1], matchID), replayRounds)
      : undefined;
    if (opts.metadata) result.metadata = fields[2] ? JSON.parse(fields[2]) : {};
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
      .del(replayRoundsKey(matchID))
      .srem(ALL_MATCHES_KEY, matchID)
      .zrem(DEADLINES_KEY, matchID)
      .zrem(WAITING_KEY, matchID)
      .srem(RESOLVING_KEY, matchID)
      .srem(ARCHIVE_PENDING_KEY, matchID);
    for (const userId of invitedUserIds) transaction.zrem(`battle:invites:user:${userId}`, matchID);
    await transaction.exec();
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

  async listResolvingMatchIds(): Promise<string[]> {
    return redis.smembers(RESOLVING_KEY);
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
      ARCHIVE_PENDING_KEY,
      replayRoundsKey(matchID),
      matchID,
      String(now),
    ));
    if (expired !== 1) return false;
    if (invitedUserIds.length > 0) {
      const transaction = redis.multi();
      for (const userId of invitedUserIds) {
        transaction.zrem(`battle:invites:user:${userId}`, matchID);
      }
      await transaction.exec();
    }
    return true;
  }

  async listPendingArchiveMatchIds(): Promise<string[]> {
    return redis.smembers(ARCHIVE_PENDING_KEY);
  }

  async getPendingArchive(matchID: string): Promise<BattleReplayV1 | null> {
    const payload = await redis.hget(battleOnlineMatchKey(matchID), 'archive');
    return payload ? JSON.parse(payload) as BattleReplayV1 : null;
  }

  async markArchivePublished(matchID: string): Promise<void> {
    await redis
      .multi()
      .hset(battleOnlineMatchKey(matchID), 'archive_status', 'published')
      .expire(battleOnlineMatchKey(matchID), ARCHIVED_MATCH_TTL_SECONDS)
      .expire(replayRoundsKey(matchID), ARCHIVED_MATCH_TTL_SECONDS)
      .srem(ARCHIVE_PENDING_KEY, matchID)
      .srem(ALL_MATCHES_KEY, matchID)
      .zrem(DEADLINES_KEY, matchID)
      .srem(RESOLVING_KEY, matchID)
      .exec();
  }

  async resolveExpired(matchID: string, now = Date.now()): Promise<boolean> {
    const fetched = await this.fetch(matchID, { state: true });
    const current = fetched.state as StoredState;
    if (current.G.presentation) {
      if (current.G.presentation.endsAt > now) {
        await this.reconcileDeadlineIndexForState(matchID, current);
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
      await this.reconcileDeadlineIndexForState(matchID, current);
      return false;
    }
    const next = resolveBoardgameTimeout(current.G, now);
    if (next === current.G) return false;
    return this.compareAndSetState(matchID, withGameState(current, next));
  }

  async reconcileDeadlineIndex(matchID: string): Promise<boolean> {
    const stateJson = await redis.hget(battleOnlineMatchKey(matchID), 'state');
    if (!stateJson) return false;
    return this.reconcileDeadlineIndexForState(
      matchID,
      parseState(stateJson, matchID),
    );
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
      .expire(battleOnlineMatchKey(matchID), ARCHIVED_MATCH_TTL_SECONDS)
      .expire(replayRoundsKey(matchID), ARCHIVED_MATCH_TTL_SECONDS)
      .srem(ALL_MATCHES_KEY, matchID)
      .zrem(DEADLINES_KEY, matchID)
      .zrem(WAITING_KEY, matchID)
      .srem(RESOLVING_KEY, matchID)
      .srem(ARCHIVE_PENDING_KEY, matchID)
      .exec();
    return true;
  }

  private async compareAndSetState(matchID: string, state: StoredState): Promise<boolean> {
    const [currentJson, initialStateJson, storedRoundCount] = await Promise.all([
      redis.hget(battleOnlineMatchKey(matchID), 'state'),
      redis.hget(battleOnlineMatchKey(matchID), 'initial_state'),
      redis.llen(replayRoundsKey(matchID)),
    ]);
    if (!currentJson || !initialStateJson) {
      throw new Error(`Unknown boardgame match: ${matchID}`);
    }
    parseState(currentJson, matchID);
    const initialBattle = parseState(initialStateJson, matchID).G.battle;
    if (state.G.matchId !== matchID) throw new Error('Boardgame match id does not match battle state');
    if (state._stateID < 1) {
      throw new Error('Battle boardgame state id conflict');
    }
    const deadlineAt = indexedDeadline(state.G);
    const acceptDeadlineAt = indexedAcceptDeadline(state.G);
    const storedState = stripReplayRounds(state);
    const nextRounds = state.G.replay.rounds;
    const appendedRoundCount = nextRounds.length - storedRoundCount;
    if (appendedRoundCount < 0 || appendedRoundCount > 1) {
      throw new Error('Battle replay accumulator conflict');
    }
    const replayRound = appendedRoundCount === 1
      ? JSON.stringify(nextRounds[nextRounds.length - 1])
      : '';
    const archive = state.G.status === 'finished' && !state.G.presentation
      ? buildReplay(state.G, initialBattle)
      : null;
    const result = Number(await getRedisClient().eval(
      SET_STATE_LUA,
      7,
      battleOnlineMatchKey(matchID),
      DEADLINES_KEY,
      RESOLVING_KEY,
      ALL_MATCHES_KEY,
      WAITING_KEY,
      ARCHIVE_PENDING_KEY,
      replayRoundsKey(matchID),
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
      String(storedRoundCount),
    ));
    if (result === 1) return true;
    // boardgame.io persists the unchanged state after INVALID_MOVE. Treat only
    // byte-identical, equal-stateID writes as a successful idempotent no-op.
    if (result === 2) return true;
    if (result === -2) throw new Error(`Unknown boardgame match: ${matchID}`);
    if (result === -3) throw new Error('Battle replay accumulator conflict');
    if (result === -1 || result === -4) return false;
    throw new Error(`Unexpected battle boardgame CAS result: ${result}`);
  }

  private async reconcileDeadlineIndexForState(
    matchID: string,
    state: StoredState,
  ): Promise<boolean> {
    const deadlineAt = indexedDeadline(state.G);
    const result = Number(await getRedisClient().eval(
      RECONCILE_DEADLINE_LUA,
      2,
      battleOnlineMatchKey(matchID),
      DEADLINES_KEY,
      String(state._stateID),
      matchID,
      deadlineAt === null ? '' : String(deadlineAt),
    ));
    if (result === 1) return true;
    if (result === 0 || result === 2) return false;
    if (result === -2) throw new Error(`Unknown boardgame match: ${matchID}`);
    throw new Error(`Unexpected battle deadline reconciliation result: ${result}`);
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

function stripReplayRounds(state: StoredState): StoredState {
  return {
    ...state,
    G: {
      ...state.G,
      replay: { ...state.G.replay, rounds: [] },
    },
  };
}

function hydrateReplay(
  state: StoredState,
  roundJson: readonly string[] = [],
): StoredState {
  const rounds = roundJson.map((value) => JSON.parse(value) as BattleBoardgameG['replay']['rounds'][number]);
  return {
    ...state,
    G: {
      ...state.G,
      replay: {
        version: 'battle_replay_accumulator_v1',
        rounds,
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
): BattleReplayV1 {
  const outcome = G.latestResolution?.outcome;
  if (!outcome?.battleEnded || G.replay.rounds.length === 0) {
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
    rounds: G.replay.rounds,
    finalSnapshot: createBattlePublicSnapshot(G.battle),
    outcome,
  };
}

function parseState(value: string, matchID: string): StoredState {
  const state = JSON.parse(value) as StoredState;
  if (state.G.matchId !== matchID || state.G.version !== 'battle_match_state_v1') {
    throw new Error('Invalid stored boardgame battle state');
  }
  return state;
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

function arenaStartIndexKey(roomId: string, startRequestId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(roomId) || !/^[A-Za-z0-9_-]{1,120}$/.test(startRequestId)) {
    throw new Error('Invalid arena orchestration key');
  }
  return `battle:arena:start:${roomId}:${startRequestId}`;
}
