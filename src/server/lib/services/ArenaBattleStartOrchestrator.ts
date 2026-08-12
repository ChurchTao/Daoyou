import {
  isRedisLockContention,
  withRedisLock,
} from '@server/lib/redis/lock';
import type { ArenaRoomV1 } from '@shared/contracts/arena';
import { ArenaRoomService } from './ArenaRoomService';
import { BattleMatchmakerService } from './BattleMatchmakerService';
import { buildOnlineBattleMatchState } from './BattleOnlineMatchFactory';

export interface ArenaBattleStartResult {
  readonly room: ArenaRoomV1;
  readonly pending: boolean;
}

export class ArenaBattleStartOrchestrator {
  constructor(
    private readonly rooms = new ArenaRoomService(),
    private readonly matchmaker = new BattleMatchmakerService(),
  ) {}

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
          timeoutMs: 60_000,
          retries: 0,
        },
        async (lease) => {
          let room = await this.rooms.start(
            input.roomId,
            input.hostUserId,
            input.requestId,
          );
          if (room.battleMatchId) return { room, pending: false };
          if (!room.frozenRoster || !room.startRequestId) {
            throw new Error('擂台房间缺少冻结阵容');
          }

          const alpha = room.frozenRoster.seats
            .filter((seat) => seat.teamId === 'alpha')
            .sort((left, right) => left.slot - right.slot);
          const beta = room.frozenRoster.seats
            .filter((seat) => seat.teamId === 'beta')
            .sort((left, right) => left.slot - right.slot);
          const state = await buildOnlineBattleMatchState({
            matchId: `arena-${crypto.randomUUID()}`,
            teams: [
              { cultivatorIds: alpha.map((seat) => seat.cultivatorId) },
              { cultivatorIds: beta.map((seat) => seat.cultivatorId) },
            ],
          });
          assertFrozenRosterMatchesControllers(room, state.controllers);
          lease.assertHeld();

          const created = await this.matchmaker.createAndPrejoin({
            state,
            orchestration: {
              kind: 'arena_sparring_v1',
              roomId: room.roomId,
              startRequestId: room.startRequestId,
            },
          });
          lease.assertHeld();

          room = await this.rooms.attachBattleMatch(
            room.roomId,
            room.startRequestId,
            created.matchID,
          );
          return { room, pending: false };
        },
      );
    } catch (error) {
      if (!isRedisLockContention(error)) throw error;
      const room = await this.rooms.getRoom(input.roomId);
      if (!room) {
        throw new Error('擂台房间不存在或已过期', { cause: error });
      }
      return { room, pending: !room.battleMatchId };
    }
  }
}

function assertFrozenRosterMatchesControllers(
  room: ArenaRoomV1,
  controllers: readonly {
    playerId: string;
    teamId: string;
    unitIds: readonly string[];
  }[],
): void {
  const frozen = room.frozenRoster;
  if (!frozen) throw new Error('擂台房间缺少冻结阵容');
  const expected = frozen.seats
    .map((seat) => `${seat.userId}:${seat.teamId}:${seat.cultivatorId}`)
    .sort();
  const actual = controllers
    .flatMap((controller) =>
      controller.unitIds.map(
        (unitId) => `${controller.playerId}:${controller.teamId}:${unitId}`,
      ),
    )
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('冻结擂台阵容与战斗控制权不一致');
  }
}
