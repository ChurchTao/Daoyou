import type { BattleCleanupManifestV1 } from '@shared/contracts/battleTerminal';
import { ArenaRoomService } from './ArenaRoomService';
import { publishArenaRoomChanges } from './arenaRoomBroadcaster';

const arenaRooms = new ArenaRoomService();

/**
 * Releases ephemeral arena room indexes from a stable terminal manifest. If
 * the manifest is corrupt or unavailable, ArenaRoomService falls back to the
 * battle-to-room reverse index. The operation is idempotent and does not
 * depend on replay archival.
 */
export async function releaseArenaRoomForBattle(
  manifest: BattleCleanupManifestV1,
): Promise<boolean> {
  const result = await arenaRooms.forceReleaseTerminalBattle(manifest);
  if (!result.released) return false;
  publishArenaRoomChanges(result.userIds, {
    roomId: result.roomId ?? manifest.matchId,
    revision: result.revision,
    status: 'finished',
  });
  return true;
}
