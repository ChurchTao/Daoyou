import type { RealmStage, RealmType } from '@shared/types/constants';
import { z } from 'zod';

/** Public, non-ranked and non-consuming arena sparring room. */
export const ARENA_SPARRING_MODE_V1 = 'arena_sparring_v1' as const;
export const ARENA_ROOM_INVITE_CODE_LENGTH = 6;
export const ARENA_ROOM_MAX_SEATS_PER_TEAM = 4;
export const ARENA_ROOM_TTL_SECONDS = 30 * 60;

export type ArenaRoomModeV1 = typeof ARENA_SPARRING_MODE_V1;
export type ArenaTeamIdV1 = 'alpha' | 'beta';
export type ArenaRoomStatusV1 =
  | 'assembling'
  | 'ready_check'
  | 'starting'
  | 'in_battle'
  | 'finished'
  | 'cancelled'
  | 'expired';

export interface ArenaSparringRulesV1 {
  readonly version: 'arena_sparring_rules_v1';
  /** Entry fees, wagers and persistent resources are never consumed. */
  readonly persistentCostPolicy: 'none';
  readonly consumablesAllowed: false;
  readonly persistentConditionEffect: 'none';
  readonly rewardPolicy: 'none';
  readonly rankingPolicy: 'none';
}

export interface ArenaRoomSeatV1 {
  readonly slot: number;
  readonly userId: string;
  readonly cultivatorId: string;
  readonly displayName: string;
  /** Optional for compatibility with rooms created before realm snapshots were added. */
  readonly realm?: RealmType;
  readonly realmStage?: RealmStage;
  readonly ready: boolean;
  readonly joinedAt: number;
  readonly lastSeenAt: number;
}

export interface ArenaFrozenRosterSeatV1 {
  readonly slot: number;
  readonly userId: string;
  readonly cultivatorId: string;
  readonly displayName: string;
  readonly teamId: ArenaTeamIdV1;
}

export interface ArenaFrozenRosterV1 {
  readonly version: 'arena_frozen_roster_v1';
  readonly startRequestId: string;
  readonly frozenAt: number;
  readonly seats: readonly ArenaFrozenRosterSeatV1[];
}

export interface ArenaRoomV1 {
  readonly version: 'arena_room_v1';
  readonly roomId: string;
  readonly mode: ArenaRoomModeV1;
  readonly rules: ArenaSparringRulesV1;
  readonly inviteCode: string;
  readonly status: ArenaRoomStatusV1;
  readonly hostUserId: string;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly battleMatchId?: string;
  readonly startRequestId?: string;
  readonly frozenRoster?: ArenaFrozenRosterV1;
  readonly teams: Readonly<Record<ArenaTeamIdV1, readonly ArenaRoomSeatV1[]>>;
}

export const ArenaInviteCodeSchema = z
  .string()
  .regex(/^\d{6}$/, '擂台邀请码必须是 6 位数字');

export const ArenaTeamIdSchema = z.enum(['alpha', 'beta']);

export const ArenaCreateRoomSchema = z.object({}).strict();

export const ArenaJoinRoomSchema = z
  .object({
    inviteCode: ArenaInviteCodeSchema,
  })
  .strict();

export const ArenaReadyCommandSchema = z
  .object({
    ready: z.boolean(),
  })
  .strict();

export const ArenaStartCommandSchema = z
  .object({
    requestId: z.string().uuid(),
  })
  .strict();

export type ArenaRoomCommandV1 =
  | {
      readonly type: 'join';
      readonly userId: string;
      readonly cultivatorId: string;
    }
  | { readonly type: 'leave'; readonly userId: string }
  | {
      readonly type: 'set_ready';
      readonly userId: string;
      readonly ready: boolean;
    }
  | { readonly type: 'switch_team'; readonly userId: string }
  | { readonly type: 'touch'; readonly userId: string }
  | {
      readonly type: 'start';
      readonly userId: string;
      readonly requestId: string;
    };

export interface ArenaRoomResponseV1 {
  readonly room: ArenaRoomV1;
}

export interface ArenaStartResponseV1 extends ArenaRoomResponseV1 {
  readonly pending: boolean;
  readonly battleMatchId?: string;
}

export const ARENA_SPARRING_RULES_V1: ArenaSparringRulesV1 = {
  version: 'arena_sparring_rules_v1',
  persistentCostPolicy: 'none',
  consumablesAllowed: false,
  persistentConditionEffect: 'none',
  rewardPolicy: 'none',
  rankingPolicy: 'none',
};

export function isArenaRoomActive(status: ArenaRoomStatusV1): boolean {
  return status === 'assembling' || status === 'ready_check';
}

export function allArenaSeatsReady(room: ArenaRoomV1): boolean {
  const seats = [...room.teams.alpha, ...room.teams.beta];
  return seats.length >= 2 && seats.every((seat) => seat.ready);
}

export function hasBothArenaTeams(room: ArenaRoomV1): boolean {
  return room.teams.alpha.length > 0 && room.teams.beta.length > 0;
}

export function selectArenaJoinTeam(room: ArenaRoomV1): ArenaTeamIdV1 {
  const alphaCount = room.teams.alpha.length;
  const betaCount = room.teams.beta.length;
  if (
    alphaCount >= ARENA_ROOM_MAX_SEATS_PER_TEAM &&
    betaCount >= ARENA_ROOM_MAX_SEATS_PER_TEAM
  ) {
    throw new Error('房间已满');
  }
  return alphaCount < betaCount ? 'alpha' : 'beta';
}

export function freezeArenaRoster(
  room: ArenaRoomV1,
  startRequestId: string,
  frozenAt: number,
): ArenaFrozenRosterV1 {
  if (!startRequestId || !Number.isFinite(frozenAt)) {
    throw new Error(
      'Arena roster freeze requires a request id and finite time',
    );
  }
  return {
    version: 'arena_frozen_roster_v1',
    startRequestId,
    frozenAt,
    seats: (['alpha', 'beta'] as const).flatMap((teamId) =>
      [...room.teams[teamId]]
        .sort((left, right) => left.slot - right.slot)
        .map((seat) => ({
          slot: seat.slot,
          userId: seat.userId,
          cultivatorId: seat.cultivatorId,
          displayName: seat.displayName,
          teamId,
        })),
    ),
  };
}
