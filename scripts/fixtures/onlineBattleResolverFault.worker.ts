import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import type { RoundCommandSetV1 } from '@shared/engine/battle-v5/round/types';

declare const self: Worker;

self.onmessage = (event: MessageEvent<{
  readonly id: string;
  readonly battle: BattleSaveV1;
  readonly commandSet: RoundCommandSetV1;
}>) => {
  const request = event.data;
  if (request.commandSet.commandSetId.startsWith('fault:hang')) return;
  try {
    self.postMessage({
      id: request.id,
      ok: true,
      resolution: resolveBattleRound(request.battle, request.commandSet),
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
