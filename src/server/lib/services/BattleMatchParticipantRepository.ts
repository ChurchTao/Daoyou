import { redis } from '@server/lib/redis';
import { battleOnlineMatchKey } from './BattleOnlineRedisKeys';

export type BattleMatchParticipantStatus = 'invited' | 'accepted';

interface StoredBattleMatchParticipant {
  readonly matchId: string;
  readonly userId: string;
  readonly teamId: string;
  readonly cultivatorIds: readonly string[];
  readonly status: BattleMatchParticipantStatus;
  readonly createdAt: string;
  readonly acceptedAt?: string;
}

function invitationKey(userId: string): string {
  if (!userId) throw new Error('Battle participant user id is required');
  return `battle:invites:user:${userId}`;
}

export async function getBattleMatchParticipant(
  matchId: string,
  userId: string,
) {
  const participants = await loadParticipants(matchId);
  return (
    participants.find((participant) => participant.userId === userId) ?? null
  );
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
      (candidate) =>
        candidate.userId === userId && candidate.status === 'invited',
    );
    if (participant) invitations.push(participant);
    else stale.push(matchId);
  });
  if (stale.length > 0) await redis.zrem(invitationKey(userId), ...stale);
  return invitations.map((invitation) => ({
    matchId: invitation.matchId,
    teamId: invitation.teamId,
    cultivatorIds: invitation.cultivatorIds,
    createdAt: invitation.createdAt,
  }));
}

async function loadParticipants(
  matchId: string,
): Promise<StoredBattleMatchParticipant[]> {
  const value = await redis.hget(battleOnlineMatchKey(matchId), 'participants');
  return value ? parseParticipants(value) : [];
}

function parseParticipants(value: string): StoredBattleMatchParticipant[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (participant): participant is StoredBattleMatchParticipant =>
        participant !== null &&
        typeof participant === 'object' &&
        'matchId' in participant &&
        typeof participant.matchId === 'string' &&
        'userId' in participant &&
        typeof participant.userId === 'string' &&
        'teamId' in participant &&
        typeof participant.teamId === 'string' &&
        'cultivatorIds' in participant &&
        Array.isArray(participant.cultivatorIds) &&
        participant.cultivatorIds.every(
          (cultivatorId: unknown) => typeof cultivatorId === 'string',
        ) &&
        'status' in participant &&
        (participant.status === 'invited' || participant.status === 'accepted'),
    );
  } catch {
    return [];
  }
}
