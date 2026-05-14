import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import { createBattleUnitsWithInit } from '@shared/engine/battle-v5/setup/BattleInitApplier';
import type { BattleInitConfigV5 } from '@shared/engine/battle-v5/setup/types';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@shared/types/cultivator';
import type { BattleRecord } from '@shared/types/battle';

export function simulateBattleV5(
  player: Cultivator,
  opponent: Cultivator,
  initConfig?: BattleInitConfigV5,
): BattleRecord {
  EventBus.instance.reset();

  const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
    player,
    opponent,
    initConfig,
  );

  const engine = new BattleEngineV5(playerUnit, opponentUnit);

  try {
    const battleResult = engine.execute();

    const winnerCultivator =
      battleResult.winner === playerUnit.id ? player : opponent;
    const loserCultivator =
      battleResult.winner === playerUnit.id ? opponent : player;

    return {
      winner: winnerCultivator,
      loser: loserCultivator,
      logs: battleResult.logs,
      turns: battleResult.turns,
      player: player.id ?? playerUnit.id,
      opponent: opponent.id ?? opponentUnit.id,
      logSpans: battleResult.logSpans ?? [],
      stateTimeline: battleResult.stateTimeline ?? {
        frames: [],
        unitIds: [playerUnit.id, opponentUnit.id],
        unitNames: {
          [playerUnit.id]: playerUnit.name,
          [opponentUnit.id]: opponentUnit.name,
        },
      },
      winnerSnapshot: battleResult.winnerSnapshot as UnitStateSnapshot,
      loserSnapshot: battleResult.loserSnapshot as UnitStateSnapshot | undefined,
    };
  } finally {
    engine.destroy();
    EventBus.instance.reset();
  }
}
