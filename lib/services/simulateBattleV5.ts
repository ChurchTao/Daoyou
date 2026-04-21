/**
 * simulateBattleV5
 *
 * 统一战斗入口：输入两个 Cultivator（+ 可选初始状态），输出 v5 原生的 BattleRecord。
 * 内部只使用 battle-v5 API，不再做任何 legacy 结构降级。
 */

import { BattleEngineV5 } from '@/engine/battle-v5/BattleEngineV5';
import { createCombatUnitFromCultivator } from '@/engine/battle-v5/adapters/CultivatorCombatAdapter';
import { EventBus } from '@/engine/battle-v5/core/EventBus';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@/types/cultivator';
import type { BattleRecord, InitialUnitState } from './battleResult';

function applyInitialState(
  unit: ReturnType<typeof createCombatUnitFromCultivator>,
  state?: InitialUnitState,
) {
  if (!state) return;

  if (state.hpLossPercent && state.hpLossPercent > 0) {
    unit.setHp(Math.floor(unit.getMaxHp() * (1 - state.hpLossPercent)));
  }
  if (state.mpLossPercent && state.mpLossPercent > 0) {
    unit.takeMp(Math.floor(unit.getMaxMp() * state.mpLossPercent));
  }
}

export function simulateBattleV5(
  player: Cultivator,
  opponent: Cultivator,
  initialPlayerState?: InitialUnitState,
): BattleRecord {
  EventBus.instance.reset();

  const playerUnit = createCombatUnitFromCultivator(player);
  const opponentUnit = createCombatUnitFromCultivator(opponent);

  applyInitialState(playerUnit, initialPlayerState);
  if (
    initialPlayerState?.isTraining &&
    initialPlayerState.opponentMaxHpOverride &&
    initialPlayerState.opponentMaxHpOverride > 0
  ) {
    opponentUnit.overrideResourceCaps(initialPlayerState.opponentMaxHpOverride);
    opponentUnit.setHp(initialPlayerState.opponentMaxHpOverride);
  }

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
