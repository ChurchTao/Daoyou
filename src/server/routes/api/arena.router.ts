import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  getValidatedJson,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { ArenaBattleStartOrchestrator } from '@server/lib/services/ArenaBattleStartOrchestrator';
import { publishArenaRoomChanges } from '@server/lib/services/arenaRoomBroadcaster';
import { ArenaRoomService } from '@server/lib/services/ArenaRoomService';
import {
  ArenaCreateRoomSchema,
  ArenaJoinRoomSchema,
  ArenaReadyCommandSchema,
  ArenaStartCommandSchema,
  type ArenaRoomV1,
} from '@shared/contracts/arena';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const RoomIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^arena-[A-Za-z0-9-]+$/);
const RealmSchema = z.enum(REALM_VALUES);
const RealmStageSchema = z.enum(REALM_STAGE_VALUES);

const router = new Hono<AppEnv>();
const rooms = new ArenaRoomService();
const starts = new ArenaBattleStartOrchestrator(rooms);
const EmptyCommandSchema = z.object({}).strict();

router.get('/room', requireActiveCultivatorRef(), async (c) => {
  const identity = await requireArenaIdentity(c);
  if (identity instanceof Response) return identity;
  return c.json({
    room: await rooms.getRoomForCultivator(identity.cultivatorId),
  });
});

router.get('/rooms/:roomId', requireActiveCultivatorRef(), async (c) => {
  const roomId = RoomIdSchema.parse(c.req.param('roomId'));
  const identity = await requireArenaIdentity(c);
  if (identity instanceof Response) return identity;
  const room = await rooms.getRoom(roomId);
  if (!room) return c.json({ error: '擂台房间不存在或已过期' }, 404);
  const participant = room.teams.alpha
    .concat(room.teams.beta)
    .some(
      (seat) =>
        seat.userId === identity.userId &&
        seat.cultivatorId === identity.cultivatorId,
    );
  if (!participant) return c.json({ error: '你不在此擂台房间中' }, 403);
  return c.json({ room });
});

router.post(
  '/rooms',
  requireActiveCultivatorRef(),
  validateJson(ArenaCreateRoomSchema),
  async (c) => {
    const identity = await requireArenaIdentity(c);
    if (identity instanceof Response) return identity;
    try {
      const room = await rooms.createRoom({
        userId: identity.userId,
        cultivatorId: identity.cultivatorId,
        displayName: identity.displayName,
        realm: identity.realm,
        realmStage: identity.realmStage,
      });
      publishRoom(room);
      return c.json({ room }, 201);
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/join',
  requireActiveCultivatorRef(),
  validateJson(ArenaJoinRoomSchema),
  async (c) => {
    const identity = await requireArenaIdentity(c);
    if (identity instanceof Response) return identity;
    const body = getValidatedJson<{
      inviteCode: string;
    }>(c);
    try {
      const room = await rooms.joinRoom({
        ...identity,
        inviteCode: body.inviteCode,
      });
      publishRoom(room);
      return c.json({ room });
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/:roomId/ready',
  requireActiveCultivatorRef(),
  validateJson(ArenaReadyCommandSchema),
  async (c) => {
    const roomId = RoomIdSchema.parse(c.req.param('roomId'));
    const identity = await requireArenaMember(c, roomId);
    if (identity instanceof Response) return identity;
    const { ready } = getValidatedJson<{ ready: boolean }>(c);
    try {
      const room = await rooms.setReady(roomId, identity.userId, ready);
      publishRoom(room);
      return c.json({ room });
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/:roomId/touch',
  requireActiveCultivatorRef(),
  validateJson(EmptyCommandSchema),
  async (c) => {
    const roomId = RoomIdSchema.parse(c.req.param('roomId'));
    const identity = await requireArenaMember(c, roomId);
    if (identity instanceof Response) return identity;
    try {
      const room = await rooms.touch(roomId, identity.userId);
      publishRoom(room);
      return c.json({ room });
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/:roomId/switch-team',
  requireActiveCultivatorRef(),
  validateJson(EmptyCommandSchema),
  async (c) => {
    const roomId = RoomIdSchema.parse(c.req.param('roomId'));
    const identity = await requireArenaMember(c, roomId);
    if (identity instanceof Response) return identity;
    try {
      const room = await rooms.switchTeam(roomId, identity.userId);
      publishRoom(room);
      return c.json({ room });
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/:roomId/start',
  requireActiveCultivatorRef(),
  validateJson(ArenaStartCommandSchema),
  async (c) => {
    const roomId = RoomIdSchema.parse(c.req.param('roomId'));
    const identity = await requireArenaMember(c, roomId);
    if (identity instanceof Response) return identity;
    const { requestId } = getValidatedJson<{ requestId: string }>(c);
    try {
      const result = await starts.start({
        roomId,
        hostUserId: identity.userId,
        requestId,
      });
      publishRoom(result.room);
      return c.json(
        {
          room: result.room,
          pending: result.pending,
          ...(result.room.battleMatchId
            ? { battleMatchId: result.room.battleMatchId }
            : {}),
        },
        result.pending ? 202 : 200,
      );
    } catch (error) {
      const current = await rooms.getRoom(roomId).catch(() => null);
      if (current) publishRoom(current);
      if (
        error instanceof Error &&
        /BATTLE_SERVER|Battle matchmaker|Battle session gateway|fetch failed|timed out/i.test(
          error.message,
        )
      ) {
        console.error('[arena-start] battle orchestration failed', {
          roomId,
          error,
        });
        return c.json({ error: '战斗服务暂不可用，开擂状态已保留' }, 503);
      }
      return arenaError(c, error);
    }
  },
);

router.post(
  '/rooms/:roomId/leave',
  requireActiveCultivatorRef(),
  validateJson(EmptyCommandSchema),
  async (c) => {
    const roomId = RoomIdSchema.parse(c.req.param('roomId'));
    const identity = await requireArenaMember(c, roomId);
    if (identity instanceof Response) return identity;
    try {
      const previous = await rooms.getRoom(roomId);
      if (!previous) return c.json({ error: '擂台房间不存在或已过期' }, 404);
      const room = await rooms.leave(roomId, identity.userId);
      publishArenaRoomChanges(arenaUserIds(previous), {
        roomId,
        revision: room?.revision ?? previous.revision + 1,
        status: room?.status ?? 'cancelled',
      });
      return c.json({ room });
    } catch (error) {
      return arenaError(c, error);
    }
  },
);

async function requireArenaIdentity(c: Context<AppEnv>) {
  const user = c.get('user');
  const active = c.get('activeCultivatorRef');
  if (!user || !active) return c.json({ error: '当前没有可用的活跃角色' }, 404);
  const row = await getExecutor().query.cultivators.findFirst({
    columns: {
      id: true,
      userId: true,
      name: true,
      realm: true,
      realm_stage: true,
    },
    where: and(
      eq(cultivators.id, active.cultivatorId),
      eq(cultivators.userId, user.id),
      eq(cultivators.status, 'active'),
    ),
  });
  if (!row) return c.json({ error: '当前没有可用的活跃角色' }, 404);
  const realm = RealmSchema.safeParse(row.realm);
  const realmStage = RealmStageSchema.safeParse(row.realm_stage);
  if (!realm.success || !realmStage.success) {
    return c.json({ error: '当前角色境界数据无效' }, 500);
  }
  return {
    userId: row.userId,
    cultivatorId: row.id,
    displayName: row.name,
    realm: realm.data,
    realmStage: realmStage.data,
  };
}

async function requireArenaMember(c: Context<AppEnv>, roomId: string) {
  const identity = await requireArenaIdentity(c);
  if (identity instanceof Response) return identity;
  const room = await rooms.getRoom(roomId);
  if (!room) return c.json({ error: '擂台房间不存在或已过期' }, 404);
  const member = room.teams.alpha
    .concat(room.teams.beta)
    .some(
      (seat) =>
        seat.userId === identity.userId &&
        seat.cultivatorId === identity.cultivatorId,
    );
  if (!member) return c.json({ error: '当前活跃修士不在此擂台房间中' }, 403);
  return identity;
}

function arenaError(c: Context<AppEnv>, error: unknown) {
  const message = error instanceof Error ? error.message : '擂台房间操作失败';
  if (/不存在|过期|邀请码无效/.test(message)) {
    return c.json({ error: message }, 404);
  }
  if (
    /已经|已满|不能|需要|准备|房主|不接受|不在|不可用|状态已变化/.test(message)
  ) {
    return c.json({ error: message }, 409);
  }
  throw error;
}

function arenaUserIds(room: ArenaRoomV1): string[] {
  return room.teams.alpha.concat(room.teams.beta).map((seat) => seat.userId);
}

function publishRoom(room: ArenaRoomV1): void {
  publishArenaRoomChanges(arenaUserIds(room), {
    roomId: room.roomId,
    revision: room.revision,
    status: room.status,
    room,
  });
}

export default router;
