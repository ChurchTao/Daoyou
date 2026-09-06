import { isRedisLockContention, withRedisLock } from '@server/lib/redis/lock';
import type { ArenaRoomV1 } from '@shared/contracts/arena';
import { ArenaRoomService } from './ArenaRoomService';
import { createArenaV6 } from './combat-v6/CombatV6ArenaService';
import { CombatV6ArenaStore } from './combat-v6/CombatV6ArenaStore';

export interface ArenaBattleStartResult {
  readonly room: ArenaRoomV1;
  readonly pending: boolean;
}
export class ArenaBattleStartOrchestrator {
  constructor(private readonly rooms = new ArenaRoomService()) {}
  async start(input: {
    readonly roomId: string;
    readonly hostUserId: string;
    readonly requestId: string;
  }): Promise<ArenaBattleStartResult> {
    try {
      return await withRedisLock(
        {
          key: `lock:arena-room:start:${input.roomId}`,
          context: 'arena-room-start',
          timeoutMs: 60000,
          retries: 0,
        },
        async (lease) => {
          let room = await this.rooms.start(
            input.roomId,
            input.hostUserId,
            input.requestId,
          );
          if (room.battleMatchId) return { room, pending: false };
          let id: string;
          try {
            id = await createArenaV6(room);
          } catch (error) {
            const committed = await new CombatV6ArenaStore().source(
              room.roomId,
              room.startRequestId!,
            );
            if (committed) id = committed;
            else {
              await this.rooms.resetFailedStart(
                room.roomId,
                room.startRequestId!,
              );
              throw error;
            }
          }
          lease.assertHeld();
          room = await this.rooms.attachBattleMatch(
            room.roomId,
            room.startRequestId!,
            id,
          );
          return { room, pending: false };
        },
      );
    } catch (error) {
      if (!isRedisLockContention(error)) throw error;
      const room = await this.rooms.getRoom(input.roomId);
      if (!room) throw new Error('擂台房间不存在或已过期', { cause: error });
      return { room, pending: !room.battleMatchId };
    }
  }
}
