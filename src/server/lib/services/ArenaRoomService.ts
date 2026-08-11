import { redis } from '@server/lib/redis';
import {
  allArenaSeatsReady,
  ARENA_ROOM_INVITE_CODE_LENGTH,
  ARENA_ROOM_MAX_SEATS_PER_TEAM,
  ARENA_ROOM_TTL_SECONDS,
  ARENA_SPARRING_MODE_V1,
  ARENA_SPARRING_RULES_V1,
  freezeArenaRoster,
  hasBothArenaTeams,
  isArenaRoomActive,
  selectArenaJoinTeam,
  type ArenaRoomSeatV1,
  type ArenaRoomStatusV1,
  type ArenaRoomV1,
  type ArenaTeamIdV1,
} from '@shared/contracts/arena';
import type { RealmStage, RealmType } from '@shared/types/constants';

const ROOM_KEY_PREFIX = 'arena:room:v1:';
const CODE_KEY_PREFIX = 'arena:room-code:v1:';
const USER_KEY_PREFIX = 'arena:user-room:v1:';
const CULTIVATOR_KEY_PREFIX = 'arena:cultivator-room:v1:';
const BATTLE_KEY_PREFIX = 'arena:battle-room:v1:';

const CREATE_ROOM_LUA = `
local roomKey = KEYS[1]
local codeKey = KEYS[2]
local userKey = KEYS[3]
local cultivatorKey = KEYS[4]
local revisionKey = KEYS[5]
if redis.call('exists', roomKey) == 1 or redis.call('exists', codeKey) == 1 then return 0 end
if redis.call('exists', userKey) == 1 or redis.call('exists', cultivatorKey) == 1 then return -1 end
redis.call('set', roomKey, ARGV[1], 'EX', ARGV[2])
redis.call('set', revisionKey, '1', 'EX', ARGV[2])
redis.call('set', codeKey, ARGV[3], 'EX', ARGV[2])
redis.call('set', userKey, ARGV[3], 'EX', ARGV[2])
redis.call('set', cultivatorKey, ARGV[3], 'EX', ARGV[2])
return 1
`;

const CAS_ROOM_LUA = `
local roomKey = KEYS[1]
local revisionKey = KEYS[2]
if redis.call('exists', roomKey) == 0 then return -2 end
local current = redis.call('get', revisionKey)
if current == false or tonumber(current) ~= tonumber(ARGV[1]) then return -1 end
redis.call('set', roomKey, ARGV[2], 'EX', ARGV[4])
redis.call('set', revisionKey, ARGV[3], 'EX', ARGV[4])
for index = 3, #KEYS do redis.call('expire', KEYS[index], ARGV[4]) end
return 1
`;

const CAS_ROOM_WITH_TWO_INDEXES_LUA = `
local roomKey = KEYS[1]
local revisionKey = KEYS[2]
local firstKey = KEYS[3]
local secondKey = KEYS[4]
if redis.call('exists', roomKey) == 0 then return -2 end
local current = redis.call('get', revisionKey)
if current == false or tonumber(current) ~= tonumber(ARGV[1]) then return -1 end
if redis.call('exists', firstKey) == 1 or redis.call('exists', secondKey) == 1 then return -3 end
redis.call('set', firstKey, ARGV[5], 'EX', ARGV[4])
redis.call('set', secondKey, ARGV[5], 'EX', ARGV[4])
redis.call('set', roomKey, ARGV[2], 'EX', ARGV[4])
redis.call('set', revisionKey, ARGV[3], 'EX', ARGV[4])
for index = 5, #KEYS do redis.call('expire', KEYS[index], ARGV[4]) end
return 1
`;

const CAS_ROOM_REMOVE_INDEXES_LUA = `
local roomKey = KEYS[1]
local revisionKey = KEYS[2]
local firstKey = KEYS[3]
local secondKey = KEYS[4]
if redis.call('exists', roomKey) == 0 then return -2 end
local current = redis.call('get', revisionKey)
if current == false or tonumber(current) ~= tonumber(ARGV[1]) then return -1 end
if redis.call('get', firstKey) == ARGV[5] then redis.call('del', firstKey) end
if redis.call('get', secondKey) == ARGV[5] then redis.call('del', secondKey) end
redis.call('set', roomKey, ARGV[2], 'EX', ARGV[4])
redis.call('set', revisionKey, ARGV[3], 'EX', ARGV[4])
for index = 5, #KEYS do redis.call('expire', KEYS[index], ARGV[4]) end
return 1
`;

const DELETE_ROOM_LUA = `
local roomKey = KEYS[1]
local revisionKey = KEYS[2]
local codeKey = KEYS[3]
if redis.call('exists', roomKey) == 0 then return 0 end
local current = redis.call('get', revisionKey)
if ARGV[1] ~= '' and (current == false or tonumber(current) ~= tonumber(ARGV[1])) then return -1 end
redis.call('del', roomKey, revisionKey, codeKey)
for index = 4, #KEYS do
  redis.call('del', KEYS[index])
end
return 1
`;

const DELETE_INDEX_IF_MATCHES_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0
`;

const ATTACH_BATTLE_LUA = `
local roomKey = KEYS[1]
local revisionKey = KEYS[2]
local battleKey = KEYS[3]
if redis.call('exists', roomKey) == 0 then return -2 end
local current = redis.call('get', revisionKey)
if current == false or tonumber(current) ~= tonumber(ARGV[1]) then return -1 end
if redis.call('exists', battleKey) == 1 and redis.call('get', battleKey) ~= ARGV[6] then return -3 end
redis.call('set', battleKey, ARGV[6], 'EX', ARGV[4])
redis.call('set', roomKey, ARGV[2], 'EX', ARGV[4])
redis.call('set', revisionKey, ARGV[3], 'EX', ARGV[4])
return 1
`;

export interface CreateArenaRoomInput {
  readonly userId: string;
  readonly cultivatorId: string;
  readonly displayName: string;
  readonly realm: RealmType;
  readonly realmStage: RealmStage;
  readonly teamId?: ArenaTeamIdV1;
  readonly now?: number;
}

export interface JoinArenaRoomInput extends Omit<
  CreateArenaRoomInput,
  'teamId'
> {
  readonly inviteCode: string;
}

export class ArenaRoomService {
  async createRoom(input: CreateArenaRoomInput): Promise<ArenaRoomV1> {
    const now = input.now ?? Date.now();
    const roomId = `arena-${crypto.randomUUID()}`;
    const teamId = input.teamId ?? 'alpha';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const inviteCode = createInviteCode();
      const room = createRoomState({
        ...input,
        roomId,
        inviteCode,
        teamId,
        now,
      });
      const result = Number(
        await redis.eval(
          CREATE_ROOM_LUA,
          5,
          roomKey(roomId),
          codeKey(inviteCode),
          userKey(input.userId),
          cultivatorKey(input.cultivatorId),
          revisionKey(roomId),
          JSON.stringify(room),
          String(ARENA_ROOM_TTL_SECONDS),
          roomId,
        ),
      );
      if (result === 1) return room;
      if (result === -1) throw new Error('玩家或修士已经在其他擂台房间中');
    }
    throw new Error('暂时无法生成唯一擂台邀请码，请稍后重试');
  }

  async getRoom(roomId: string): Promise<ArenaRoomV1 | null> {
    return parseRoom(await redis.get(roomKey(roomId)));
  }

  async getRoomForUser(userId: string): Promise<ArenaRoomV1 | null> {
    const index = userKey(userId);
    const roomId = await redis.get(index);
    if (!roomId) return null;
    const room = await this.getRoom(roomId);
    if (room && findSeat(room, userId)) return room;
    await redis.eval(DELETE_INDEX_IF_MATCHES_LUA, 1, index, roomId);
    return null;
  }

  async getRoomForCultivator(
    cultivatorId: string,
  ): Promise<ArenaRoomV1 | null> {
    const index = cultivatorKey(cultivatorId);
    const roomId = await redis.get(index);
    if (!roomId) return null;
    const room = await this.getRoom(roomId);
    if (room && findCultivatorSeat(room, cultivatorId)) return room;
    await redis.eval(DELETE_INDEX_IF_MATCHES_LUA, 1, index, roomId);
    return null;
  }

  async getRoomByInviteCode(inviteCode: string): Promise<ArenaRoomV1 | null> {
    if (!/^\d{6}$/.test(inviteCode)) return null;
    const roomId = await redis.get(codeKey(inviteCode));
    return roomId ? this.getRoom(roomId) : null;
  }

  async joinRoom(input: JoinArenaRoomInput): Promise<ArenaRoomV1> {
    const room = await this.requireRoomByCode(input.inviteCode);
    assertRoomJoinable(room);
    if (
      room.teams.alpha.some((seat) => seat.userId === input.userId) ||
      room.teams.beta.some((seat) => seat.userId === input.userId)
    ) {
      if (
        room.teams.alpha
          .concat(room.teams.beta)
          .some((seat) => seat.cultivatorId === input.cultivatorId)
      )
        return room;
      throw new Error('玩家已经在此擂台房间中');
    }
    if (
      [...room.teams.alpha, ...room.teams.beta].some(
        (seat) => seat.cultivatorId === input.cultivatorId,
      )
    )
      throw new Error('该修士已经在擂台房间中');
    const teamId = selectArenaJoinTeam(room);
    const seats = room.teams[teamId];
    const now = input.now ?? Date.now();
    const next = withSeat(room, teamId, {
      slot: nextSlot(seats),
      userId: input.userId,
      cultivatorId: input.cultivatorId,
      displayName: normalizeDisplayName(input.displayName),
      realm: input.realm,
      realmStage: input.realmStage,
      ready: false,
      joinedAt: now,
      lastSeenAt: now,
    });
    return this.commitWithIndexes(
      room,
      next,
      [userKey(input.userId), cultivatorKey(input.cultivatorId)],
      room.roomId,
    );
  }

  async setReady(
    roomId: string,
    userId: string,
    ready: boolean,
    now = Date.now(),
  ): Promise<ArenaRoomV1> {
    const room = await this.requireRoom(roomId);
    assertRoomJoinable(room);
    const current = findSeat(room, userId);
    if (!current) throw new Error('玩家不在此擂台房间中');
    const next = updateSeat(room, current, { ready, lastSeenAt: now });
    const status: ArenaRoomStatusV1 = next.teams.alpha
      .concat(next.teams.beta)
      .some((seat) => seat.ready)
      ? 'ready_check'
      : 'assembling';
    return this.commit(room, { ...next, status });
  }

  async switchTeam(
    roomId: string,
    userId: string,
    now = Date.now(),
  ): Promise<ArenaRoomV1> {
    const room = await this.requireRoom(roomId);
    assertRoomJoinable(room);
    const current = findSeat(room, userId);
    if (!current) throw new Error('玩家不在此擂台房间中');
    const targetTeamId: ArenaTeamIdV1 =
      current.teamId === 'alpha' ? 'beta' : 'alpha';
    const targetSeats = room.teams[targetTeamId];
    if (targetSeats.length >= ARENA_ROOM_MAX_SEATS_PER_TEAM) {
      throw new Error('另一方队伍已满');
    }
    const moved: ArenaRoomSeatV1 = {
      slot: nextSlot(targetSeats),
      userId: current.userId,
      cultivatorId: current.cultivatorId,
      displayName: current.displayName,
      realm: current.realm,
      realmStage: current.realmStage,
      ready: false,
      joinedAt: current.joinedAt,
      lastSeenAt: now,
    };
    const next = nextRoom(room, {
      teams: {
        ...room.teams,
        [current.teamId]: room.teams[current.teamId].filter(
          (seat) => seat.userId !== userId,
        ),
        [targetTeamId]: [...targetSeats, moved],
      },
    });
    const status: ArenaRoomStatusV1 = next.teams.alpha
      .concat(next.teams.beta)
      .some((seat) => seat.ready)
      ? 'ready_check'
      : 'assembling';
    return this.commit(room, { ...next, status });
  }

  async touch(
    roomId: string,
    userId: string,
    now = Date.now(),
  ): Promise<ArenaRoomV1> {
    const room = await this.requireRoom(roomId);
    const current = findSeat(room, userId);
    if (!current || !isArenaRoomActive(room.status))
      throw new Error('擂台房间已不可用');
    return this.commit(room, updateSeat(room, current, { lastSeenAt: now }));
  }

  async leave(roomId: string, userId: string): Promise<ArenaRoomV1 | null> {
    const room = await this.requireRoom(roomId);
    assertRoomJoinable(room);
    const current = findSeat(room, userId);
    if (!current) return room;
    const remaining = removeSeat(room, current);
    if (remaining.teams.alpha.length + remaining.teams.beta.length === 0) {
      await this.deleteRoom(room, [cultivatorKey(current.cultivatorId)]);
      return null;
    }
    const hostUserId =
      room.hostUserId === userId
        ? remaining.teams.alpha
            .concat(remaining.teams.beta)
            .sort((a, b) => a.joinedAt - b.joinedAt)[0]!.userId
        : room.hostUserId;
    const next = { ...remaining, hostUserId, status: 'assembling' as const };
    const refreshKeys = roomIndexKeys(next);
    const result = Number(
      await redis.eval(
        CAS_ROOM_REMOVE_INDEXES_LUA,
        4 + refreshKeys.length,
        roomKey(room.roomId),
        revisionKey(room.roomId),
        userKey(userId),
        cultivatorKey(current.cultivatorId),
        ...refreshKeys,
        String(room.revision),
        JSON.stringify(next),
        String(next.revision),
        String(ARENA_ROOM_TTL_SECONDS),
        room.roomId,
      ),
    );
    if (result === -1) throw new Error('擂台房间状态已变化，请刷新后重试');
    if (result === -2) throw new Error('擂台房间已过期');
    if (result !== 1) throw new Error('擂台房间写入失败');
    return next;
  }

  async start(
    roomId: string,
    userId: string,
    requestId: string,
  ): Promise<ArenaRoomV1> {
    const room = await this.requireRoom(roomId);
    if (!requestId) throw new Error('擂台开擂请求缺少 requestId');
    if (room.hostUserId !== userId) throw new Error('只有房主可以开始擂台切磋');
    if (room.status === 'starting') {
      if (room.battleMatchId || room.startRequestId === requestId) return room;
      throw new Error('擂台房间正在开擂，请稍后重试');
    }
    if (room.battleMatchId) return room;
    if (!isArenaRoomActive(room.status))
      throw new Error('擂台房间当前不能开始');
    if (!hasBothArenaTeams(room)) throw new Error('双方都需要至少一名参战者');
    if (!allArenaSeatsReady(room))
      throw new Error('所有参战者准备完毕后才能开始');
    const frozenRoster = freezeArenaRoster(room, requestId, Date.now());
    return this.commit(
      room,
      nextRoom(room, {
        status: 'starting',
        startRequestId: requestId,
        frozenRoster,
      }),
    );
  }

  async attachBattleMatch(
    roomId: string,
    startRequestId: string,
    battleMatchId: string,
  ): Promise<ArenaRoomV1> {
    const room = await this.requireRoom(roomId);
    if (room.battleMatchId === battleMatchId) return room;
    if (
      room.status !== 'starting' ||
      room.startRequestId !== startRequestId ||
      !room.frozenRoster
    ) {
      throw new Error('擂台开擂状态已变化，请刷新后重试');
    }
    const next = nextRoom(room, { status: 'in_battle', battleMatchId });
    const result = Number(
      await redis.eval(
        ATTACH_BATTLE_LUA,
        3,
        roomKey(room.roomId),
        revisionKey(room.roomId),
        battleKey(battleMatchId),
        String(room.revision),
        JSON.stringify(next),
        String(next.revision),
        String(ARENA_ROOM_TTL_SECONDS),
        battleMatchId,
        room.roomId,
      ),
    );
    if (result === -1) throw new Error('擂台房间状态已变化，请刷新后重试');
    if (result === -2) throw new Error('擂台房间已过期');
    if (result === -3) throw new Error('战斗对局已经绑定其他擂台房间');
    if (result !== 1) throw new Error('擂台房间写入失败');
    return next;
  }

  async finishByBattleMatch(
    battleMatchId: string,
  ): Promise<ArenaRoomV1 | null> {
    const roomId = await redis.get(battleKey(battleMatchId));
    if (!roomId) return null;
    const room = await this.getRoom(roomId);
    if (!room || room.battleMatchId !== battleMatchId) return null;
    if (room.status !== 'in_battle' && room.status !== 'finished') return null;
    // Arena rooms are ephemeral orchestration state. Once the replay has
    // been archived, release all participant indexes so the same players and
    // cultivators can enter another room immediately.
    const deleted = await this.deleteRoom(room, [battleKey(battleMatchId)]);
    return deleted ? room : null;
  }

  private async requireRoom(roomId: string): Promise<ArenaRoomV1> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('擂台房间不存在或已过期');
    return room;
  }

  private async requireRoomByCode(code: string): Promise<ArenaRoomV1> {
    const room = await this.getRoomByInviteCode(code);
    if (!room) throw new Error('邀请码无效或擂台房间已过期');
    return room;
  }

  private async commit(
    room: ArenaRoomV1,
    next: ArenaRoomV1,
  ): Promise<ArenaRoomV1> {
    return this.commitScript(room, next);
  }

  private async commitWithIndexes(
    room: ArenaRoomV1,
    next: ArenaRoomV1,
    indexes: string[],
    roomId: string,
  ): Promise<ArenaRoomV1> {
    if (indexes.length !== 2)
      throw new Error('Arena room index update is invalid');
    const refreshKeys = roomIndexKeys(next);
    const result = Number(
      await redis.eval(
        CAS_ROOM_WITH_TWO_INDEXES_LUA,
        4 + refreshKeys.length,
        roomKey(room.roomId),
        revisionKey(room.roomId),
        indexes[0],
        indexes[1],
        ...refreshKeys,
        String(room.revision),
        JSON.stringify(next),
        String(next.revision),
        String(ARENA_ROOM_TTL_SECONDS),
        roomId,
      ),
    );
    if (result === -1) throw new Error('擂台房间状态已变化，请刷新后重试');
    if (result === -2) throw new Error('擂台房间已过期');
    if (result === -3) throw new Error('玩家或修士已经在其他擂台房间中');
    if (result !== 1) throw new Error('擂台房间写入失败');
    return next;
  }

  private async commitScript(
    room: ArenaRoomV1,
    next: ArenaRoomV1,
  ): Promise<ArenaRoomV1> {
    const refreshKeys = roomIndexKeys(next);
    const result = Number(
      await redis.eval(
        CAS_ROOM_LUA,
        2 + refreshKeys.length,
        roomKey(room.roomId),
        revisionKey(room.roomId),
        ...refreshKeys,
        String(room.revision),
        JSON.stringify(next),
        String(next.revision),
        String(ARENA_ROOM_TTL_SECONDS),
      ),
    );
    if (result === -1) throw new Error('擂台房间状态已变化，请刷新后重试');
    if (result === -2) throw new Error('擂台房间已过期');
    if (result !== 1) throw new Error('擂台房间写入失败');
    return next;
  }

  private async deleteRoom(
    room: ArenaRoomV1,
    extraKeys: readonly string[] = [],
  ): Promise<boolean> {
    const seats = room.teams.alpha.concat(room.teams.beta);
    const indexKeys = [
      ...seats.map((seat) => userKey(seat.userId)),
      ...seats.map((seat) => cultivatorKey(seat.cultivatorId)),
      ...extraKeys,
    ];
    return (
      Number(
        await redis.eval(
          DELETE_ROOM_LUA,
          3 + indexKeys.length,
          roomKey(room.roomId),
          revisionKey(room.roomId),
          codeKey(room.inviteCode),
          ...indexKeys,
          String(room.revision),
        ),
      ) === 1
    );
  }
}

function createInviteCode(): string {
  const max = 10 ** ARENA_ROOM_INVITE_CODE_LENGTH;
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return (random[0]! % max)
    .toString()
    .padStart(ARENA_ROOM_INVITE_CODE_LENGTH, '0');
}

function createRoomState(
  input: CreateArenaRoomInput & {
    roomId: string;
    inviteCode: string;
    teamId: ArenaTeamIdV1;
    now: number;
  },
): ArenaRoomV1 {
  const seat: ArenaRoomSeatV1 = {
    slot: 0,
    userId: input.userId,
    cultivatorId: input.cultivatorId,
    displayName: normalizeDisplayName(input.displayName),
    realm: input.realm,
    realmStage: input.realmStage,
    ready: false,
    joinedAt: input.now,
    lastSeenAt: input.now,
  };
  return {
    version: 'arena_room_v1',
    roomId: input.roomId,
    mode: ARENA_SPARRING_MODE_V1,
    rules: ARENA_SPARRING_RULES_V1,
    inviteCode: input.inviteCode,
    status: 'assembling',
    hostUserId: input.userId,
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + ARENA_ROOM_TTL_SECONDS * 1000,
    teams: {
      alpha: input.teamId === 'alpha' ? [seat] : [],
      beta: input.teamId === 'beta' ? [seat] : [],
    },
  };
}

function withSeat(
  room: ArenaRoomV1,
  teamId: ArenaTeamIdV1,
  seat: ArenaRoomSeatV1,
): ArenaRoomV1 {
  return nextRoom(room, {
    teams: { ...room.teams, [teamId]: [...room.teams[teamId], seat] },
  });
}
function updateSeat(
  room: ArenaRoomV1,
  seat: ArenaRoomSeatV1 & { teamId: ArenaTeamIdV1 },
  patch: Partial<ArenaRoomSeatV1>,
): ArenaRoomV1 {
  return nextRoom(room, {
    teams: {
      ...room.teams,
      [seat.teamId]: room.teams[seat.teamId].map((candidate) =>
        candidate.userId === seat.userId
          ? { ...candidate, ...patch }
          : candidate,
      ),
    },
  });
}
function removeSeat(
  room: ArenaRoomV1,
  seat: ArenaRoomSeatV1 & { teamId: ArenaTeamIdV1 },
): ArenaRoomV1 {
  return nextRoom(room, {
    teams: {
      ...room.teams,
      [seat.teamId]: room.teams[seat.teamId].filter(
        (candidate) => candidate.userId !== seat.userId,
      ),
    },
  });
}
function nextRoom(room: ArenaRoomV1, patch: Partial<ArenaRoomV1>): ArenaRoomV1 {
  const now = Date.now();
  return {
    ...room,
    ...patch,
    revision: room.revision + 1,
    updatedAt: now,
    expiresAt: now + ARENA_ROOM_TTL_SECONDS * 1000,
  };
}
function findSeat(
  room: ArenaRoomV1,
  userId: string,
): (ArenaRoomSeatV1 & { teamId: ArenaTeamIdV1 }) | null {
  for (const teamId of ['alpha', 'beta'] as const) {
    const seat = room.teams[teamId].find(
      (candidate) => candidate.userId === userId,
    );
    if (seat) return { ...seat, teamId };
  }
  return null;
}
function findCultivatorSeat(
  room: ArenaRoomV1,
  cultivatorId: string,
): ArenaRoomSeatV1 | null {
  for (const teamId of ['alpha', 'beta'] as const) {
    const seat = room.teams[teamId].find(
      (candidate) => candidate.cultivatorId === cultivatorId,
    );
    if (seat) return seat;
  }
  return null;
}
function nextSlot(seats: readonly ArenaRoomSeatV1[]): number {
  for (let slot = 0; slot < ARENA_ROOM_MAX_SEATS_PER_TEAM; slot += 1)
    if (!seats.some((seat) => seat.slot === slot)) return slot;
  throw new Error('队伍已满');
}
function assertRoomJoinable(room: ArenaRoomV1): void {
  if (!isArenaRoomActive(room.status))
    throw new Error('擂台房间当前不接受此操作');
}
function parseRoom(raw: string | null): ArenaRoomV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ArenaRoomV1;
    return parsed.version === 'arena_room_v1' ? parsed : null;
  } catch {
    return null;
  }
}
function normalizeDisplayName(value: string): string {
  const name = value.trim().slice(0, 80);
  if (!name) throw new Error('擂台玩家名称不能为空');
  return name;
}
function roomKey(id: string): string {
  return `${ROOM_KEY_PREFIX}${id}`;
}
function revisionKey(id: string): string {
  return `${ROOM_KEY_PREFIX}${id}:revision`;
}
function codeKey(code: string): string {
  return `${CODE_KEY_PREFIX}${code}`;
}
function userKey(userId: string): string {
  return `${USER_KEY_PREFIX}${userId}`;
}
function cultivatorKey(cultivatorId: string): string {
  return `${CULTIVATOR_KEY_PREFIX}${cultivatorId}`;
}
function roomIndexKeys(room: ArenaRoomV1): string[] {
  const seats = room.teams.alpha.concat(room.teams.beta);
  return [
    codeKey(room.inviteCode),
    ...seats.map((seat) => userKey(seat.userId)),
    ...seats.map((seat) => cultivatorKey(seat.cultivatorId)),
  ];
}
function battleKey(battleMatchId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(battleMatchId))
    throw new Error('Invalid battle match id');
  return `${BATTLE_KEY_PREFIX}${battleMatchId}`;
}
