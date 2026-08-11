import { getRedisClient, redis } from '@server/lib/redis';
import { battleOnlineMatchKey } from './BattleBoardgameStorage';

export type BattleMatchParticipantStatus = 'invited' | 'accepted';

export interface BattleMatchParticipantInput {
  readonly matchId: string;
  readonly userId: string;
  readonly teamId: string;
  readonly boardgamePlayerId: string;
  readonly cultivatorIds: readonly string[];
  readonly status?: BattleMatchParticipantStatus;
}

interface StoredBattleMatchParticipant {
  readonly matchId: string;
  readonly userId: string;
  readonly teamId: string;
  readonly boardgamePlayerId: string;
  readonly cultivatorIds: readonly string[];
  readonly status: BattleMatchParticipantStatus;
  readonly createdAt: string;
  readonly acceptedAt?: string;
}

const CREATE_PARTICIPANTS_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
if redis.call('HEXISTS', KEYS[1], 'participants') == 1 then return 0 end
redis.call('HSET', KEYS[1], 'participants', ARGV[1])
for index = 2, #KEYS do
  redis.call('ZADD', KEYS[index], ARGV[index + 1], ARGV[2])
end
return 1
`;

const ACCEPT_PARTICIPANT_LUA = `
local current = redis.call('HGET', KEYS[1], 'participants')
if not current then return -1 end
if current ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'participants', ARGV[2])
redis.call('ZREM', KEYS[2], ARGV[3])
return 1
`;

function invitationKey(userId: string): string {
  if (!userId) throw new Error('Battle participant user id is required');
  return `battle:invites:user:${userId}`;
}

export async function createBattleMatchParticipants(
  participants: readonly BattleMatchParticipantInput[],
): Promise<void> {
  if (participants.length === 0) throw new Error('Battle match needs participants');
  const matchId = participants[0]!.matchId;
  if (participants.some((participant) => participant.matchId !== matchId)) {
    throw new Error('Battle participants must belong to one match');
  }
  const createdAt = new Date().toISOString();
  const stored: StoredBattleMatchParticipant[] = participants.map((participant) => ({
    ...participant,
    cultivatorIds: [...participant.cultivatorIds],
    status: participant.status ?? 'invited',
    createdAt,
    ...(participant.status === 'accepted' ? { acceptedAt: createdAt } : {}),
  }));
  const invited = stored.filter((participant) => participant.status === 'invited');
  const keys = [battleOnlineMatchKey(matchId), ...invited.map((value) => invitationKey(value.userId))];
  const args = [JSON.stringify(stored), matchId, ...invited.map(() => String(Date.parse(createdAt)))];
  const result = Number(await getRedisClient().eval(
    CREATE_PARTICIPANTS_LUA,
    keys.length,
    ...keys,
    ...args,
  ));
  if (result === -1) throw new Error(`Unknown boardgame match: ${matchId}`);
  if (result === 0) throw new Error(`Battle participants already exist: ${matchId}`);
}

export async function ensureBattleMatchParticipants(
  participants: readonly BattleMatchParticipantInput[],
): Promise<void> {
  try {
    await createBattleMatchParticipants(participants);
  } catch (error) {
    if (!(error instanceof Error) || !/already exist/.test(error.message)) {
      throw error;
    }
    const existing = await loadParticipants(participants[0]!.matchId);
    const expected = participants.map((participant) => ({
      userId: participant.userId,
      teamId: participant.teamId,
      boardgamePlayerId: participant.boardgamePlayerId,
      cultivatorIds: [...participant.cultivatorIds],
      status: participant.status ?? 'invited',
    }));
    const actual = existing.map((participant) => ({
      userId: participant.userId,
      teamId: participant.teamId,
      boardgamePlayerId: participant.boardgamePlayerId,
      cultivatorIds: [...participant.cultivatorIds],
      status: participant.status,
    }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw error;
  }
}

export async function getBattleMatchParticipant(matchId: string, userId: string) {
  const participants = await loadParticipants(matchId);
  return participants.find((participant) => participant.userId === userId) ?? null;
}

export async function listBattleMatchInvitations(userId: string) {
  const matchIds = await redis.zrevrange(invitationKey(userId), 0, 99);
  if (matchIds.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const matchId of matchIds) {
    pipeline.hget(battleOnlineMatchKey(matchId), 'participants');
  }
  const rows = await pipeline.exec();
  const invitations: StoredBattleMatchParticipant[] = [];
  const stale: string[] = [];
  rows?.forEach((row, index) => {
    const matchId = matchIds[index]!;
    const value = row?.[1];
    if (typeof value !== 'string') {
      stale.push(matchId);
      return;
    }
    const participant = parseParticipants(value).find(
      (candidate) => candidate.userId === userId && candidate.status === 'invited',
    );
    if (participant) invitations.push(participant);
    else stale.push(matchId);
  });
  if (stale.length > 0) await redis.zrem(invitationKey(userId), ...stale);
  return invitations.map((invitation) => ({
    matchId: invitation.matchId,
    teamId: invitation.teamId,
    boardgamePlayerId: invitation.boardgamePlayerId,
    cultivatorIds: invitation.cultivatorIds,
    createdAt: invitation.createdAt,
  }));
}

export async function acceptBattleMatchParticipant(matchId: string, userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentJson = await redis.hget(battleOnlineMatchKey(matchId), 'participants');
    if (!currentJson) return null;
    const participants = parseParticipants(currentJson);
    const index = participants.findIndex((participant) => participant.userId === userId);
    if (index < 0) return null;
    const current = participants[index]!;
    if (current.status === 'accepted') return current;
    const accepted: StoredBattleMatchParticipant = {
      ...current,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    };
    const next = [...participants];
    next[index] = accepted;
    const result = Number(await getRedisClient().eval(
      ACCEPT_PARTICIPANT_LUA,
      2,
      battleOnlineMatchKey(matchId),
      invitationKey(userId),
      currentJson,
      JSON.stringify(next),
      matchId,
    ));
    if (result === 1) return accepted;
    if (result === -1) return null;
  }
  throw new Error('Battle participant accept conflict');
}

async function loadParticipants(matchId: string): Promise<StoredBattleMatchParticipant[]> {
  const value = await redis.hget(battleOnlineMatchKey(matchId), 'participants');
  return value ? parseParticipants(value) : [];
}

function parseParticipants(value: string): StoredBattleMatchParticipant[] {
  const parsed = JSON.parse(value) as StoredBattleMatchParticipant[];
  if (!Array.isArray(parsed)) throw new Error('Invalid battle participants');
  return parsed;
}
