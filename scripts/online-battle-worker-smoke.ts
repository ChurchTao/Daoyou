import { transitionBattleMatch } from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import {
  OnlineBattleResolutionError,
  OnlineBattleResolverPool,
} from '@server/lib/services/OnlineBattleResolverPool';
import {
  basicIntentsForPlayer,
  createOnlineBattleFixture,
} from './online-battle-fixture';

let state = createOnlineBattleFixture('worker-smoke', 2);
for (const controller of state.controllers) {
  state = transitionBattleMatch(state, {
    type: 'commit_player_intents',
    matchId: state.matchId,
    requestId: crypto.randomUUID(),
    playerId: controller.playerId,
    expectedMatchRevision: state.revision,
    expectedCheckpointRevision: state.battle.checkpoint.checkpointRevision,
    intents: basicIntentsForPlayer(state, controller.playerId),
  }, Date.now()).state;
}
if (!state.resolving) throw new Error('Worker fixture did not enter resolving');

const pool = new OnlineBattleResolverPool({
  size: 1,
  executionTimeoutMs: 100,
  queueTimeoutMs: 500,
  workerUrl: new URL('./fixtures/onlineBattleResolverFault.worker.ts', import.meta.url),
});
try {
  const commandSet = state.resolving.commandSet;
  await pool.resolve(state.battle, { ...commandSet, commandSetId: 'fault:hang' })
    .then(() => {
      throw new Error('Fault-injected Worker unexpectedly resolved');
    })
    .catch((error: unknown) => {
      if (
        !(error instanceof OnlineBattleResolutionError) ||
        error.code !== 'RESOLVER_EXECUTION_TIMEOUT'
      ) {
        throw error;
      }
    });
  const recovered = await pool.resolve(state.battle, commandSet);
  if (recovered.round !== commandSet.round) {
    throw new Error('Replacement Worker returned the wrong round');
  }
  console.info('online battle Worker timeout and restart smoke passed');
} finally {
  pool.close();
}
