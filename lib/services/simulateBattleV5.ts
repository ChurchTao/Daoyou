/**
 * simulateBattleV5
 *
 * 统一战斗入口：输入两个 Cultivator（+ 可选初始状态），输出 v5 原生的 BattleRecord。
 * 内部只使用 battle-v5 API，不再做任何 legacy 结构降级。
 */

import { BattleEngineV5 } from '@/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@/engine/battle-v5/core/EventBus';
import { createBattleUnitsWithInit } from '@/engine/battle-v5/setup/BattleInitApplier';
import type { BattleInitConfigV5 } from '@/engine/battle-v5/setup/types';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@/types/cultivator';
import type { BattleRecord } from './battleResult';

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
