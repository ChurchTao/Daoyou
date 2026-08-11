import { describe, expect, it } from 'vitest';
import {
  allArenaSeatsReady,
  ArenaInviteCodeSchema,
  freezeArenaRoster,
  hasBothArenaTeams,
  selectArenaJoinTeam,
  type ArenaRoomSeatV1,
  type ArenaRoomV1,
} from './arena';

function seat(userId: string, ready = true): ArenaRoomSeatV1 {
  return {
    slot: 0,
    userId,
    cultivatorId: `cultivator-${userId}`,
    displayName: userId,
    ready,
    joinedAt: 1,
    lastSeenAt: 1,
  };
}

function room(
  alpha: readonly ArenaRoomSeatV1[],
  beta: readonly ArenaRoomSeatV1[],
): ArenaRoomV1 {
  return {
    version: 'arena_room_v1',
    roomId: 'arena-room',
    mode: 'arena_sparring_v1',
    rules: {
      version: 'arena_sparring_rules_v1',
      persistentCostPolicy: 'none',
      consumablesAllowed: false,
      persistentConditionEffect: 'none',
      rewardPolicy: 'none',
      rankingPolicy: 'none',
    },
    inviteCode: '123456',
    status: 'ready_check',
    hostUserId: 'host',
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 2,
    teams: { alpha, beta },
  };
}

describe('arena room contract', () => {
  it('only accepts six digit invitation codes', () => {
    expect(ArenaInviteCodeSchema.safeParse('012345').success).toBe(true);
    expect(ArenaInviteCodeSchema.safeParse('12345').success).toBe(false);
    expect(ArenaInviteCodeSchema.safeParse('12345a').success).toBe(false);
  });

  it('allows asymmetric teams when every participant is ready', () => {
    const asymmetric = room([seat('alpha')], [seat('beta-1'), seat('beta-2')]);
    expect(hasBothArenaTeams(asymmetric)).toBe(true);
    expect(allArenaSeatsReady(asymmetric)).toBe(true);
    expect(asymmetric.rules).toMatchObject({
      persistentCostPolicy: 'none',
      consumablesAllowed: false,
      persistentConditionEffect: 'none',
      rewardPolicy: 'none',
      rankingPolicy: 'none',
    });
  });

  it('does not become startable while any participant is unready', () => {
    const waiting = room([seat('alpha')], [seat('beta', false)]);
    expect(allArenaSeatsReady(waiting)).toBe(false);
  });

  it('assigns new participants to the smaller team and uses beta as the tie-breaker', () => {
    expect(selectArenaJoinTeam(room([seat('alpha')], []))).toBe('beta');
    expect(selectArenaJoinTeam(room([seat('alpha')], [seat('beta')]))).toBe(
      'beta',
    );
    expect(
      selectArenaJoinTeam(
        room([seat('alpha')], [seat('beta-1'), seat('beta-2')]),
      ),
    ).toBe('alpha');
  });

  it('rejects joining when both teams are full', () => {
    const fullTeam = (prefix: string) =>
      Array.from({ length: 4 }, (_, index) => seat(`${prefix}-${index}`));
    expect(() =>
      selectArenaJoinTeam(room(fullTeam('alpha'), fullTeam('beta'))),
    ).toThrow('房间已满');
  });

  it('freezes an asymmetric roster with stable team and slot ownership', () => {
    const asymmetric = room(
      [{ ...seat('alpha'), slot: 2 }],
      [
        { ...seat('beta-2'), slot: 3 },
        { ...seat('beta-1'), slot: 0 },
      ],
    );
    const frozen = freezeArenaRoster(asymmetric, 'request-1', 1_000);
    expect(frozen).toMatchObject({
      version: 'arena_frozen_roster_v1',
      startRequestId: 'request-1',
      frozenAt: 1_000,
    });
    expect(
      frozen.seats.map((entry) => [entry.teamId, entry.slot, entry.userId]),
    ).toEqual([
      ['alpha', 2, 'alpha'],
      ['beta', 0, 'beta-1'],
      ['beta', 3, 'beta-2'],
    ]);
  });
});
