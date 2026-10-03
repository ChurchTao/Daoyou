import type { ArenaRoomV1 } from '@daoyou/shared/contracts/arena';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@daoyou/shared/types/constants';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { ArenaBattleStartOrchestrator } from '@server/arena/application/ArenaBattleStartOrchestrator.js';
import { ArenaRoomService } from '@server/arena/application/ArenaRoomService.js';
import { publishArenaRoomChanges } from '@server/realtime/infrastructure/arenaRoomBroadcaster.js';
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

function roomError(error: unknown): never {
  if (error instanceof CombatV6BuildError)
    throw new HttpException(
      { error: error.message, code: error.code },
      error.status,
    );
  const message = error instanceof Error ? error.message : '擂台房间操作失败';
  if (/不存在|过期|邀请码无效/.test(message))
    throw new HttpException({ error: message }, 404);
  if (
    /已经|已满|不能|需要|准备|房主|不接受|不在|不可用|状态已变化/.test(message)
  )
    throw new HttpException({ error: message }, 409);
  throw error;
}

function userIds(room: ArenaRoomV1) {
  return room.teams.alpha
    .concat(room.teams.beta, room.spectators ?? [])
    .map((seat) => seat.userId);
}
function publish(room: ArenaRoomV1): void {
  publishArenaRoomChanges(userIds(room), {
    roomId: room.roomId,
    revision: room.revision,
    status: room.status,
    room,
  });
}

@Injectable()
export class ArenaRoomsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(ArenaRoomService) private readonly rooms: ArenaRoomService,
    @Inject(ArenaBattleStartOrchestrator)
    private readonly starts: ArenaBattleStartOrchestrator,
  ) {}

  private async identity(actor: ActiveCultivatorRef) {
    const row = await this.database.query.cultivators.findFirst({
      columns: {
        id: true,
        userId: true,
        name: true,
        realm: true,
        realm_stage: true,
      },
      where: and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    });
    if (!row) throw new HttpException({ error: '当前没有可用的活跃角色' }, 404);
    const realm = z.enum(REALM_VALUES).safeParse(row.realm);
    const realmStage = z.enum(REALM_STAGE_VALUES).safeParse(row.realm_stage);
    if (!realm.success || !realmStage.success)
      throw new HttpException({ error: '当前角色境界数据无效' }, 500);
    return {
      userId: row.userId,
      cultivatorId: row.id,
      displayName: row.name,
      realm: realm.data,
      realmStage: realmStage.data,
    };
  }

  private async memberRoom(
    actor: ActiveCultivatorRef,
    roomId: string,
    message: string,
  ) {
    const room = await this.rooms.getRoom(roomId);
    if (!room)
      throw new HttpException({ error: '擂台房间不存在或已过期' }, 404);
    if (
      !room.teams.alpha
        .concat(room.teams.beta, room.spectators ?? [])
        .some(
          (seat) =>
            seat.userId === actor.userId &&
            seat.cultivatorId === actor.cultivatorId,
        )
    )
      throw new HttpException({ error: message }, 403);
    return room;
  }

  async current(actor: ActiveCultivatorRef) {
    const identity = await this.identity(actor);
    return {
      room: await this.rooms.getRoomForCultivator(identity.cultivatorId),
    };
  }
  async read(actor: ActiveCultivatorRef, roomId: string) {
    await this.identity(actor);
    return { room: await this.memberRoom(actor, roomId, '你不在此擂台房间中') };
  }
  async create(actor: ActiveCultivatorRef) {
    const identity = await this.identity(actor);
    try {
      const room = await this.rooms.createRoom(identity);
      publish(room);
      return { room };
    } catch (error) {
      roomError(error);
    }
  }
  async join(
    actor: ActiveCultivatorRef,
    input: { inviteCode: string; role: 'participant' | 'spectator' },
  ) {
    const identity = await this.identity(actor);
    try {
      const room = await this.rooms.joinRoom({ ...identity, ...input });
      publish(room);
      return { room };
    } catch (error) {
      roomError(error);
    }
  }
  async change(
    actor: ActiveCultivatorRef,
    roomId: string,
    command:
      { kind: 'ready'; ready: boolean } | { kind: 'touch' | 'switch-team' },
  ) {
    const identity = await this.identity(actor);
    await this.memberRoom(actor, roomId, '当前活跃修士不在此擂台房间中');
    try {
      const room = await (command.kind === 'ready'
        ? this.rooms.setReady(roomId, identity.userId, command.ready)
        : command.kind === 'touch'
          ? this.rooms.touch(roomId, identity.userId)
          : this.rooms.switchTeam(roomId, identity.userId));
      publish(room);
      return { room };
    } catch (error) {
      roomError(error);
    }
  }
  async start(actor: ActiveCultivatorRef, roomId: string, requestId: string) {
    const identity = await this.identity(actor);
    await this.memberRoom(actor, roomId, '当前活跃修士不在此擂台房间中');
    try {
      const result = await this.starts.start({
        roomId,
        hostUserId: identity.userId,
        requestId,
      });
      publish(result.room);
      return {
        status: result.pending ? 202 : 200,
        body: {
          room: result.room,
          pending: result.pending,
          ...(result.room.battleMatchId
            ? { battleMatchId: result.room.battleMatchId }
            : {}),
        },
      };
    } catch (error) {
      const current = await this.rooms.getRoom(roomId).catch(() => null);
      if (current) publish(current);
      if (
        error instanceof Error &&
        /Battle matchmaker|Battle session|fetch failed|timed out/i.test(
          error.message,
        )
      ) {
        console.error('[arena-start] battle orchestration failed', {
          roomId,
          error,
        });
        throw new HttpException(
          { error: '战斗服务暂不可用，开擂状态已保留' },
          503,
        );
      }
      roomError(error);
    }
  }
  async leave(actor: ActiveCultivatorRef, roomId: string) {
    const identity = await this.identity(actor);
    await this.memberRoom(actor, roomId, '当前活跃修士不在此擂台房间中');
    try {
      const previous = await this.rooms.getRoom(roomId);
      if (!previous)
        throw new HttpException({ error: '擂台房间不存在或已过期' }, 404);
      const room = await this.rooms.leave(roomId, identity.userId);
      publishArenaRoomChanges(userIds(previous), {
        roomId,
        revision: room?.revision ?? previous.revision + 1,
        status: room?.status ?? 'cancelled',
      });
      return { room: null };
    } catch (error) {
      roomError(error);
    }
  }
}
