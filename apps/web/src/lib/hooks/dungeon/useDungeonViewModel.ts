import { useQiActionConfirm } from '@app/components/feature/cultivator/useQiActionConfirm';
import { QI_ACTION_COSTS } from '@daoyou/game-content/qi/config';
import type {
  DungeonRecoverAction,
  DungeonSettlement,
  DungeonState,
} from '@daoyou/game-domain/dungeon';
import type {
  MysteryAction,
  MysteryAnswers,
  MysteryEvidence,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import type { ResourceOperation } from '@daoyou/game-domain/resources';
import { useMemo } from 'react';
import type { BattleCallbackData } from './types';
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
  /** 旧版回合制留下的未完成副本：只能结束探索。 */
  | { type: 'legacy'; state: DungeonState }
  | { type: 'mystery'; state: DungeonState; view: MysteryPlayerView }
  | { type: 'battle_preparation'; state: DungeonState }
  | {
      type: 'in_battle';
      battleId: string;
      state: DungeonState;
    }
  | { type: 'recoverable_error'; state: DungeonState }
  | {
      type: 'settlement';
      settlement?: DungeonSettlement;
      realGains?: ResourceOperation[];
      mystery?: MysteryPlayerView;
    };

export type DungeonMutationResolution =
  | { type: 'none' }
  | { type: 'refresh' }
  | { type: 'state'; state: DungeonState }
  | {
      type: 'settlement';
      settlement?: DungeonSettlement;
      realGains?: ResourceOperation[];
      state?: DungeonState;
    }
  | { type: 'clear' };

export function resolveDungeonMutationResult(
  data:
    | {
        conflict?: boolean;
        state?: DungeonState;
        isFinished?: boolean;
        settlement?: DungeonSettlement;
        realGains?: ResourceOperation[];
        success?: boolean;
      }
    | null
    | undefined,
): DungeonMutationResolution {
  if (!data) return { type: 'none' };
  if (data.conflict) return { type: 'refresh' };
  if (data.isFinished) {
    return {
      type: 'settlement',
      settlement: data.settlement,
      realGains: data.realGains,
      state: data.state,
    };
  }
  if (data.state) return { type: 'state', state: data.state };
  if (data.success) return { type: 'clear' };
  return { type: 'none' };
}

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
    error: readError,
    dismissSettlement,
  } = useDungeonState(cultivatorId);
  const {
    startDungeon,
    beginBattle,
    quitDungeon,
    recoverDungeon,
    mysteryAct,
    mysteryDeduce,
    mysteryTalk,
    mysteryGuard,
    processing,
  } = useDungeonActions(refresh, state);

  const { openQiActionConfirm } = useQiActionConfirm();

  /**
   * 计算当前视图状态
   */
  const viewState = useMemo<DungeonViewState>(() => {
    // 加载中
    if (stateLoading && !state) {
      return { type: 'loading' };
    }

    // 未认证
    if (!hasCultivator) {
      return { type: 'not_authenticated' };
    }

    if (
      !state?.isFinished &&
      state?.status === 'WAITING_BATTLE' &&
      state.encounter
    )
      return { type: 'battle_preparation', state };
    // 战斗中
    if (
      !state?.isFinished &&
      state?.status === 'IN_BATTLE' &&
      state.activeBattleId
    ) {
      return { type: 'in_battle', battleId: state.activeBattleId, state };
    }

    // 结算
    if (state?.isFinished) {
      return {
        type: 'settlement',
        settlement: state.settlement,
        realGains: state.realGains,
        mystery: state.mysteryView,
      };
    }

    if (state?.status === 'RECOVERABLE_ERROR') {
      return { type: 'recoverable_error', state };
    }

    if (state?.mysteryView && state.status === 'EXPLORING') {
      return { type: 'mystery', state, view: state.mysteryView };
    }

    if (state && !state.mysteryView) {
      return { type: 'legacy', state };
    }

    // 地图选择
    return {
      type: 'map_selection',
      preSelectedNodeId,
    };
  }, [stateLoading, hasCultivator, state, preSelectedNodeId]);

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
        }
      },
    });
  };

  const handleRecoverDungeon = async (action: DungeonRecoverAction) => {
    const data = await recoverDungeon(action);
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
  };

  const applyMutationResult = async (
    data: Parameters<typeof resolveDungeonMutationResult>[0],
  ) => {
    const resolution = resolveDungeonMutationResult(data);
    if (resolution.type === 'refresh') {
      refresh();
      return;
    }
    if (resolution.type === 'state') {
      setState(resolution.state);
    } else if (resolution.type === 'settlement') {
      setState((prev) => {
        const base = resolution.state ?? prev;
        return base
          ? {
              ...base,
              isFinished: true,
              settlement: resolution.settlement,
              realGains: resolution.realGains,
            }
          : null;
      });
    } else if (resolution.type === 'clear') {
      setState(null);
    }
  };

  const handleMysteryAct = async (action: MysteryAction) => {
    if (!state?.runId || !state.mysteryView) return;
    const data = await mysteryAct(state.runId, state.mysteryView.turn, action);
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
  };

  const handleMysteryGuard = async (guardId: string) => {
    if (!state?.runId || !state.mysteryView) return;
    const data = await mysteryGuard(
      state.runId,
      state.mysteryView.turn,
      guardId,
    );
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
  };

  const handleMysteryTalk = async (npcId: string, question: string) => {
    if (!state?.runId || !state.mysteryView) return false;
    const data = await mysteryTalk(
      state.runId,
      state.mysteryView.turn,
      npcId,
      question,
    );
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
    return data !== null;
  };

  const handleMysteryDeduce = async (
    answers: MysteryAnswers,
    evidence: MysteryEvidence,
  ) => {
    if (!state?.runId) return;
    const data = await mysteryDeduce(state.runId, answers, evidence);
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
  };

  /**
   * 操作：退出副本
   */
  const handleQuitDungeon = async (): Promise<boolean> => {
    const data = await quitDungeon();
    if (!data) return false;
    await applyMutationResult(
      data as Parameters<typeof resolveDungeonMutationResult>[0],
    );
    return true;
  };

  /**
   * 操作：战斗完成
   */
  const handleBattleComplete = (data: BattleCallbackData | null) => {
    if (data?.isFinished) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isFinished: true,
              settlement: data.settlement,
              realGains: data.realGains,
              // 解谜对决结束后评分随最终状态下发。
              mysteryView: data.dungeonState?.mysteryView ?? prev.mysteryView,
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
    processing: processing || stateLoading || !!readError,
    readError,
    refreshing: stateLoading,
    refresh,
    dismissSettlement,
    actions: {
      beginBattle: async () => {
        if (!state?.encounter) return;
        await applyMutationResult(
          (await beginBattle(state.encounter.id)) as Parameters<
            typeof resolveDungeonMutationResult
          >[0],
        );
      },
      startDungeon: handleStartDungeon,
      quitDungeon: handleQuitDungeon,
      recoverDungeon: handleRecoverDungeon,
      completeBattle: handleBattleComplete,
      mysteryAct: handleMysteryAct,
      mysteryDeduce: handleMysteryDeduce,
      mysteryTalk: handleMysteryTalk,
      mysteryGuard: handleMysteryGuard,
    },
  };
}
