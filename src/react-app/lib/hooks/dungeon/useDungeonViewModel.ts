import { BattleCallbackData } from '@app/routes/game/dungeon/components/DungeonBattle';
import { DungeonAbandonBattleResult } from './useEnemyProbe';
import type { ResourceOperation } from '@shared/engine/resource/types';
import {
  DungeonOption,
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { useQiActionConfirm } from '@app/components/feature/cultivator/useQiActionConfirm';
import { invalidateQiState } from '@app/components/feature/cultivator/useQiState';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import { useMemo, useState } from 'react';
import { useDungeonActions } from './useDungeonActions';
import { useDungeonState } from './useDungeonState';

/**
 * 副本视图状态类型
 */
export type DungeonViewState =
  | { type: 'loading' }
  | { type: 'not_authenticated' }
  | {
      type: 'map_selection';
      preSelectedNodeId: string | null;
    }
  | { type: 'exploring'; state: DungeonState; lastRound: DungeonRound }
  | { type: 'battle_preparation'; state: DungeonState }
  | {
      type: 'in_battle';
      battleId: string;
      opponentName: string;
      state: DungeonState;
    }
  | { type: 'looting'; state: DungeonState }
  | { type: 'recoverable_error'; state: DungeonState }
  | {
      type: 'settlement';
      settlement?: DungeonSettlement;
      realGains?: ResourceOperation[];
    };

/**
 * 副本视图模型 Hook
 */
export function useDungeonViewModel(
  hasCultivator: boolean,
  cultivatorId: string | undefined,
  preSelectedNodeId: string | null,
) {
  // 副本状态管理
  const {
    state,
    setState,
    loading: stateLoading,
    refresh,
  } = useDungeonState(hasCultivator);
  const { startDungeon, performAction, quitDungeon, continueLooting, escapeLooting, recoverDungeon, processing } =
    useDungeonActions();

  const { openQiActionConfirm } = useQiActionConfirm();

  // 战斗相关状态
  const [activeBattleId, setActiveBattleId] = useState<string>();
  const [opponentName, setOpponentName] = useState('神秘敌手');

  /**
   * 计算最后一轮数据
   */
  const lastRound = useMemo<DungeonRound | null>(() => {
    if (!state || state.isFinished || state.history.length === 0) {
      return null;
    }

    return {
      scene_description: state.history[state.history.length - 1].scene,
      interaction: {
        options: state.currentOptions || [],
      },
      acquired_items: state.currentRoundItems || [],
      status_update: {
        is_final_round: state.currentRound >= state.maxRounds,
        internal_danger_score: state.dangerScore,
      },
    };
  }, [state]);

  /**
   * 计算当前视图状态
   */
  const viewState = useMemo<DungeonViewState>(() => {
    // 加载中
    if (stateLoading) {
      return { type: 'loading' };
    }

    // 未认证
    if (!hasCultivator) {
      return { type: 'not_authenticated' };
    }

    // 战斗中
    if (activeBattleId && state) {
      return {
        type: 'in_battle',
        battleId: activeBattleId,
        opponentName,
        state,
      };
    }

    // 战斗准备
    const shouldShowBattlePrep =
      !activeBattleId &&
      state?.status === 'WAITING_BATTLE' &&
      state.activeBattleId &&
      !state.isFinished;

    if (shouldShowBattlePrep && state) {
      return { type: 'battle_preparation', state };
    }

    // 结算
    if (state?.isFinished) {
      return {
        type: 'settlement',
        settlement: state.settlement,
        realGains: state.realGains,
      };
    }

    // 战后休整
    if (state?.status === 'LOOTING') {
      return { type: 'looting', state };
    }

    if (state?.status === 'RECOVERABLE_ERROR') {
      return { type: 'recoverable_error', state };
    }

    // 探索中
    if (state && lastRound) {
      return { type: 'exploring', state, lastRound };
    }

    // 地图选择
    return {
      type: 'map_selection',
      preSelectedNodeId,
    };
  }, [
    stateLoading,
    hasCultivator,
    activeBattleId,
    state,
    lastRound,
    opponentName,
    preSelectedNodeId,
  ]);

  /**
   * 操作：启动副本
   */
  const handleStartDungeon = async (nodeId: string) => {
    openQiActionConfirm({
      actionName: '秘境探索',
      qiCost: QI_ACTION_COSTS.dungeon_start,
      confirmLabel: '开始探索',
      onConfirm: async () => {
        const newState = await startDungeon(nodeId);
        if (newState) {
          setState(newState);
          invalidateQiState(cultivatorId);
        }
      },
    });
  };

  /**
   * 操作：执行选项
   */
  const handlePerformAction = async (option: DungeonOption) => {
    const data = await performAction(option);
    if (!data) return;

    if (data.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
            }
          : null,
      );
    } else {
      setState(data.state);
    }
  };

  const handleContinueLooting = async () => {
    const data = await continueLooting();
    if (data?.state) {
      setState(data.state);
    } else if (data?.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
            }
          : null,
      );
    }
  };

  const handleEscapeLooting = async () => {
    const data = await escapeLooting();
    if (data?.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
            }
          : null,
      );
    }
  };

  const handleRecoverDungeon = async (
    action: 'retry' | 'safe_retreat' | 'force_quit',
  ) => {
    const data = await recoverDungeon(action);
    if (!data) return;
    if (data.state) {
      setState(data.state);
    } else if (data.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
            }
          : null,
      );
    } else if (data.success) {
      setState(null);
    }
  };

  /**
   * 操作：退出副本
   */
  const handleQuitDungeon = async (): Promise<boolean> => {
    const success = await quitDungeon();
    if (success) {
      setState(null);
    }
    return success;
  };

  /**
   * 操作：开始战斗
   */
  const handleStartBattle = (enemyName: string) => {
    setOpponentName(enemyName);
    setActiveBattleId(state?.activeBattleId);
  };

  const handleAbandonBattleWithResult = async (
    result: DungeonAbandonBattleResult,
  ) => {
    setActiveBattleId(undefined);
    if (result.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: result.settlement,
              realGains: result.realGains,
            }
          : null,
      );
      return;
    }

    refresh();
  };

  /**
   * 操作：战斗完成
   */
  const handleBattleComplete = (data: BattleCallbackData | null) => {
    setActiveBattleId(undefined);

    if (data?.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
            }
          : null,
      );
    } else if (data) {
      setState(data.dungeonState ?? null);
    } else {
      refresh();
    }
  };

  return {
    viewState,
    processing,
    actions: {
      startDungeon: handleStartDungeon,
      performAction: handlePerformAction,
      quitDungeon: handleQuitDungeon,
      continueLooting: handleContinueLooting,
      escapeLooting: handleEscapeLooting,
      recoverDungeon: handleRecoverDungeon,
      startBattle: handleStartBattle,
      abandonBattle: handleAbandonBattleWithResult,
      completeBattle: handleBattleComplete,
    },
  };
}
