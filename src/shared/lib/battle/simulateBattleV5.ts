import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import type { BattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import { createBattleUnitsWithInit } from '@shared/engine/battle-v5/setup/BattleInitApplier';
import {
  assertPreparedBattleContext,
  type PreparedBattleContext,
} from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import { validateBattleRecordV3 } from '@shared/engine/battle-v5/v3';
import type { BattleRecordV3 } from '@shared/types/battle';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';

export function simulateBattleV5(
  context: PreparedBattleContext,
  randomSource?: BattleRandomSource,
): BattleRecordV3 {
  assertPreparedBattleContext(context);
  const runtime = new BattleRuntime({
    random: randomSource ?? { next: () => Math.random() },
  });

  try {
    const { player, opponent, initConfig } = context;
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      initConfig,
      runtime,
    );

    const engine = new BattleEngineV5(playerUnit, opponentUnit, runtime);

    try {
      const battleResult = engine.execute();

      const winnerUnit =
        battleResult.winner === playerUnit.id ? playerUnit : opponentUnit;
      const loserUnit = winnerUnit === playerUnit ? opponentUnit : playerUnit;

      const record: BattleRecordV3 = {
        participants: {
          player: { id: playerUnit.id, name: playerUnit.name },
          opponent: { id: opponentUnit.id, name: opponentUnit.name },
        },
        outcome: {
          winner: {
            id: winnerUnit.id,
            name: winnerUnit.name,
          },
          loser: {
            id: loserUnit.id,
            name: loserUnit.name,
          },
          turns: battleResult.turns,
        },
        sequences: battleResult.sequences,
        stateTimeline: battleResult.stateTimeline,
        finalSnapshots: {
          winner: battleResult.winnerSnapshot,
          loser: battleResult.loserSnapshot,
        },
      };
      validateBattleRecordV3(record);
      return record;
    } finally {
      engine.destroy();
      runtime.dispose();
    }
  } catch (error) {
    runtime.dispose();
    throw error;
  }
}
