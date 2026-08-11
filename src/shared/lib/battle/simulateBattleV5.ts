import {
  SeededBattleRandomSource,
  type BattleRandomSource,
  type BattleRandomStateV1,
} from '@shared/engine/battle-v5/core/BattleRandom';
import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import { resolveBattleToCompletion } from '@shared/engine/battle-v5/round/BattleAutoResolver';
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
    random: toCheckpointRandomSource(randomSource),
  });

  try {
    const { player, opponent, initConfig } = context;
    const { playerUnit, opponentUnit } = createBattleUnitsWithInit(
      player,
      opponent,
      initConfig,
      runtime,
    );

    try {
      const battleResult = resolveBattleToCompletion({
        battleId: `pve:${playerUnit.id}:${opponentUnit.id}`,
        roster: BattleRoster.fromDuel(playerUnit, opponentUnit),
        runtime,
      });

      const winnerUnit =
        battleResult.outcome.winnerTeamId === playerUnit.teamId ||
        !battleResult.outcome.winnerTeamId
          ? playerUnit
          : opponentUnit;
      const loserUnit = winnerUnit === playerUnit ? opponentUnit : playerUnit;
      const winnerSnapshot = battleResult.finalSnapshots[winnerUnit.id];
      const loserSnapshot = battleResult.finalSnapshots[loserUnit.id];
      if (!winnerSnapshot || !loserSnapshot) {
        throw new Error('战斗终态缺少参战单位状态快照');
      }

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
          turns: battleResult.rounds,
        },
        sequences: battleResult.sequences,
        stateTimeline: battleResult.stateTimeline,
        finalSnapshots: {
          winner: winnerSnapshot,
          loser: loserSnapshot,
        },
      };
      validateBattleRecordV3(record);
      return record;
    } finally {
      runtime.dispose();
    }
  } catch (error) {
    runtime.dispose();
    throw error;
  }
}

type CheckpointRandomSource = BattleRandomSource & {
  exportState(): BattleRandomStateV1;
  restoreState(state: BattleRandomStateV1): void;
};

function toCheckpointRandomSource(
  source?: BattleRandomSource,
): CheckpointRandomSource {
  const checkpointSource = source as Partial<CheckpointRandomSource> | undefined;
  if (
    source &&
    typeof checkpointSource?.exportState === 'function' &&
    typeof checkpointSource.restoreState === 'function'
  ) {
    return source as CheckpointRandomSource;
  }
  const sample = source?.next() ?? Math.random();
  return new SeededBattleRandomSource(
    Math.floor(Math.min(Math.max(sample, 0), 1 - Number.EPSILON) * 0x1_0000_0000),
  );
}
