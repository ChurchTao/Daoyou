import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import type { RoundCommandSetV1 } from '@shared/engine/battle-v5/round/types';

declare const self: Worker;

type Request = {
  readonly id: string;
  readonly battle: BattleSaveV1;
  readonly commandSet: RoundCommandSetV1;
};

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
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
      code:
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : undefined,
    });
  }
};
