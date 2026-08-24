import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import type { BattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import {
  mergeBattleUnitInitFragments,
  prepareBattleContext,
  type BattleUnitStateStrategy,
  type PreparedBattleContext,
} from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import type {
  BattleStateStrategyId,
  BattleUnitInitFragment,
} from '@shared/engine/battle-v5/setup/types';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { BattleRecordV3 } from '@shared/types/battle';
import type { CultivatorCondition } from '@shared/types/condition';
import { ConditionService } from './ConditionService';

export interface PersistentWorldBattleExecution {
  context: PreparedBattleContext;
  battleResult: BattleRecordV3;
  conditionBaseline: CultivatorCondition;
  nextCondition: CultivatorCondition;
  didLose: boolean;
}

export interface ResolvedPersistentWorldPlayerState {
  player: CultivatorCombatInput;
  playerState: BattleUnitStateStrategy & {
    resources: {
      kind: 'absolute';
      hp: number;
      mp: number;
    };
  };
  conditionBaseline: CultivatorCondition;
}

export function resolvePersistentWorldPlayerState(args: {
  player: CultivatorCombatInput;
  now: Date;
  playerFragment?: BattleUnitInitFragment;
}): ResolvedPersistentWorldPlayerState {
  const preparedCondition = ConditionService.preparePersistentBattleCondition(
    args.player,
    args.player.condition,
    args.now,
  );
  return {
    player: {
      ...args.player,
      condition: preparedCondition.condition,
    },
    playerState: {
      resources: {
        kind: 'absolute',
        hp: preparedCondition.condition.resources.hp.current,
        mp: preparedCondition.condition.resources.mp.current,
      },
      fragment: mergeBattleUnitInitFragments(
        preparedCondition.playerFragment,
        args.playerFragment,
      ),
    },
    conditionBaseline: preparedCondition.condition,
  };
}

export function preparePersistentWorldBattle(args: {
  strategyId: Extract<BattleStateStrategyId, 'persistent_world'>;
  player: CultivatorCombatInput;
  opponent: CultivatorCombatInput;
  now: Date;
  playerFragment?: BattleUnitInitFragment;
  opponentFragment?: BattleUnitInitFragment;
}): {
  context: PreparedBattleContext;
  conditionBaseline: CultivatorCondition;
} {
  const resolvedPlayer = resolvePersistentWorldPlayerState(args);
  return {
    conditionBaseline: resolvedPlayer.conditionBaseline,
    context: prepareBattleContext({
      strategyId: args.strategyId,
      player: resolvedPlayer.player,
      opponent: args.opponent,
      playerState: resolvedPlayer.playerState,
      opponentState: {
        resources: { kind: 'full' },
        fragment: args.opponentFragment,
      },
      conditionBaseline: resolvedPlayer.conditionBaseline,
    }),
  };
}

export function executePersistentWorldBattle(args: {
  strategyId: Extract<BattleStateStrategyId, 'persistent_world'>;
  player: CultivatorCombatInput;
  opponent: CultivatorCombatInput;
  now?: Date;
  playerFragment?: BattleUnitInitFragment;
  opponentFragment?: BattleUnitInitFragment;
  randomSource?: BattleRandomSource;
  playerSelectionStrategy?: AbilitySelectionStrategy;
}): PersistentWorldBattleExecution {
  const now = args.now ?? new Date();
  const prepared = preparePersistentWorldBattle({
    ...args,
    now,
  });
  const battleResult = simulateBattleV5(prepared.context, args.randomSource, {
    playerSelectionStrategy: args.playerSelectionStrategy,
  });
  const playerId = args.player.id ?? args.player.name;
  const didLose = battleResult.outcome.winner.id !== playerId;
  const playerSnapshot = didLose
    ? battleResult.finalSnapshots.loser
    : battleResult.finalSnapshots.winner;
  if (!playerSnapshot) {
    throw new Error('战斗终局缺少玩家状态快照');
  }
  const nextCondition = ConditionService.settlePersistentBattleCondition(
    args.player,
    prepared.conditionBaseline,
    playerSnapshot,
    didLose,
    now,
  );
  return {
    ...prepared,
    battleResult,
    nextCondition,
    didLose,
  };
}
