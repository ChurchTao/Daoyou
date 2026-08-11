import { ArenaRoomService } from './ArenaRoomService';
import { publishArenaRoomChanges } from './arenaRoomBroadcaster';

const arenaRooms = new ArenaRoomService();

/**
 * Releases ephemeral arena room indexes independently from replay archival.
 * The operation is idempotent: non-arena matches and already released rooms
 * return false without blocking the archive workflow.
 */
export async function releaseArenaRoomForBattle(matchId: string): Promise<boolean> {
  const arenaRoom = await arenaRooms.finishByBattleMatch(matchId);
  if (!arenaRoom) return false;
  publishArenaRoomChanges(
    arenaRoom.teams.alpha.concat(arenaRoom.teams.beta).map((seat) => seat.userId),
    {
      roomId: arenaRoom.roomId,
      revision: arenaRoom.revision + 1,
      status: arenaRoom.status,
    },
  );
  return true;
}
