import type { BattleTerminalOutboxV1 } from '@shared/contracts/battleTerminal';
import { releaseArenaRoomForBattle } from './BattleArenaRoomFinalizer';
import type { OnlineBattleStore } from './OnlineBattleStore';

export async function finalizeBattleTerminalState(
  store: Pick<
    OnlineBattleStore,
    'finalizeTerminalIndexes' | 'markTerminalCleanupCompleted'
  >,
  outbox: BattleTerminalOutboxV1,
): Promise<void> {
  if (outbox.event.matchId !== outbox.manifest.matchId) {
    throw new Error('Battle terminal event and cleanup manifest do not match');
  }
  await releaseArenaRoomForBattle(outbox.manifest);
  await store.finalizeTerminalIndexes(outbox);
  await store.markTerminalCleanupCompleted(outbox.event.matchId);
}
