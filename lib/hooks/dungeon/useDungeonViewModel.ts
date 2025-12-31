import { BattleCallbackData } from '@/app/(main)/game/dungeon/components/DungeonBattle';
import {
  DungeonOption,
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@/lib/dungeon/types';
import { useMemo, useState } from 'react';
import { useDungeonActions } from './useDungeonActions';
import { useDungeonLimit } from './useDungeonLimit';
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
      limitInfo?: { remaining: number; used: number; dailyLimit: number } | null;
      limitLoading?: boolean;
    }
  | { type: 'exploring'; state: DungeonState; lastRound: DungeonRound }
  | { type: 'battle_preparation'; state: DungeonState }
  | {
      type: 'in_battle';
      battleId: string;
      opponentName: string;
      state: DungeonState;
    }
  | { type: 'settlement'; settlement?: DungeonSettlement };

/**
 * 副本视图模型 Hook
 *
 * 职责：
 * 1. 统一管理副本的所有视图状态
 * 2. 提供清晰的状态转换接口
 * 3. 封装业务逻辑，简化组件复杂度
 */
export function useDungeonViewModel(
  hasCultivator: boolean,
  preSelectedNodeId: string | null,
) {
  // 副本状态管理
  const {
    state,
    setState,
    loading: stateLoading,
    refresh,
  } = useDungeonState(hasCultivator);
  const { startDungeon, performAction, quitDungeon, processing } =
    useDungeonActions();

  // 副本次数限制
  const {
    limitInfo,
    isLoading: limitLoading,
    refresh: refreshLimit,
  } = useDungeonLimit(hasCultivator);

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
      state?.status === 'IN_BATTLE' &&
      state.activeBattleId &&
      !state.isFinished;

    if (shouldShowBattlePrep && state) {
      return { type: 'battle_preparation', state };
    }

    // 结算
    if (state?.isFinished) {
      return { type: 'settlement', settlement: state.settlement };
    }

    // 探索中
    if (state && lastRound) {
      return { type: 'exploring', state, lastRound };
    }

    // 地图选择
    return {
      type: 'map_selection',
      preSelectedNodeId,
      limitInfo,
      limitLoading,
    };
  }, [
    stateLoading,
    hasCultivator,
    activeBattleId,
    state,
    lastRound,
    opponentName,
    preSelectedNodeId,
    limitInfo,
    limitLoading,
  ]);

  /**
   * 操作：启动副本
   */
  const handleStartDungeon = async (nodeId: string) => {
    const newState = await startDungeon(nodeId);
    if (newState) {
      setState(newState);
      // 刷新次数限制
      refreshLimit();
    }
  };

  /**
   * 操作：执行选项
   */
  const handlePerformAction = async (option: DungeonOption) => {
    const data = await performAction(option);
    if (!data) return;
    setState(data.state);
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

  /**
   * 操作：放弃战斗
   */
  const handleAbandonBattle = async () => {
    setActiveBattleId(undefined);
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
      startBattle: handleStartBattle,
      abandonBattle: handleAbandonBattle,
      completeBattle: handleBattleComplete,
    },
  };
}
