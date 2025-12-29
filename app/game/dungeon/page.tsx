'use client';

import { InkCard, InkNotice } from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { type DungeonOption, type DungeonRound } from '@/lib/dungeon/types';
import { getMapNode } from '@/lib/game/mapSystem';
import { useDungeonActions } from '@/lib/hooks/dungeon/useDungeonActions';
import { useDungeonState } from '@/lib/hooks/dungeon/useDungeonState';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BattlePreparation } from './components/BattlePreparation';
import { BattleCallbackData, DungeonBattle } from './components/DungeonBattle';
import { DungeonExploring } from './components/DungeonExploring';
import { DungeonMapSelector } from './components/DungeonMapSelector';
import { DungeonSettlement as SettlementView } from './components/DungeonSettlement';

function DungeonContent() {
  const { cultivator, isLoading: isCultivatorLoading } = useCultivatorBundle();
  const searchParams = useSearchParams();
  const preSelectedNodeId = searchParams.get('nodeId');

  // 使用hooks
  const { state, setState, loading, refresh } = useDungeonState(cultivator?.id);
  const { startDungeon, performAction, quitDungeon, processing } =
    useDungeonActions();

  // 战斗相关状态
  const [activeBattleId, setActiveBattleId] = useState<string>();
  const [opponentName, setOpponentName] = useState('神秘敌手');

  // 最后一轮数据（用于UI显示）
  const lastRound: DungeonRound | null =
    state && !state.isFinished && state.history.length > 0
      ? {
          scene_description: state.history[state.history.length - 1].scene,
          interaction: {
            options: state.currentOptions || [],
          },
          status_update: {
            is_final_round: state.currentRound >= state.maxRounds,
            internal_danger_score: state.dangerScore,
          },
        }
      : null;

  // 处理启动副本
  const handleStart = async (nodeId: string) => {
    const newState = await startDungeon(nodeId);
    if (newState) {
      setState(newState);
    }
  };

  // 处理选择选项
  const handleAction = async (option: DungeonOption) => {
    const data = await performAction(option);
    if (!data) return;
    // 更新状态
    setState(data.state);
  };

  // 处理退出副本
  const handleQuit = async (): Promise<boolean> => {
    const success = await quitDungeon();
    if (success) {
      setState(null);
    }
    return success;
  };

  // 处理开始战斗
  const handleStartBattle = (enemyName: string) => {
    setOpponentName(enemyName);
    setActiveBattleId(state?.activeBattleId);
  };

  // 处理放弃战斗
  const handleAbandonBattle = async () => {
    setActiveBattleId(undefined);
    refresh();
  };

  // 处理战斗完成
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

  // 加载状态
  if (loading || isCultivatorLoading) {
    return (
      <InkPageShell title="推演中...">
        <div className="flex justify-center p-12">
          <p className="animate-pulse">天机混沌，正在解析...</p>
        </div>
      </InkPageShell>
    );
  }

  // 未登录
  if (!cultivator) {
    return (
      <InkPageShell title="单人副本">
        <InkNotice tone="warning">请先登录或创建角色</InkNotice>
      </InkPageShell>
    );
  }

  // 战斗视图
  if (activeBattleId) {
    return (
      <DungeonBattle
        battleId={activeBattleId}
        opponentName={opponentName}
        playerName={cultivator.name}
        player={cultivator}
        onBattleComplete={handleBattleComplete}
      />
    );
  }

  // 计算是否应该显示战前准备界面（基于副本状态）
  const shouldShowBattlePrep =
    !activeBattleId &&
    state?.status === 'IN_BATTLE' &&
    state.activeBattleId &&
    !state.isFinished;

  // 战前准备视图（包括从状态恢复和新触发的战斗）
  if (shouldShowBattlePrep) {
    return (
      <BattlePreparation
        battleId={state!.activeBattleId!}
        cultivatorId={cultivator.id!}
        onStart={handleStartBattle}
        onAbandon={handleAbandonBattle}
      />
    );
  }

  // 结算视图
  if (state?.isFinished) {
    return <SettlementView settlement={state.settlement} />;
  }

  // 探索视图
  if (state && lastRound) {
    return (
      <DungeonExploring
        state={state}
        lastRound={lastRound}
        onAction={handleAction}
        onQuit={handleQuit}
        processing={processing}
      />
    );
  }

  // 地图选择视图
  const selectedNode = preSelectedNodeId ? getMapNode(preSelectedNodeId) : null;

  return (
    <InkPageShell title="云游探秘" backHref="/game" subtitle="寻找上古机缘">
      <InkCard className="p-6 mb-6">
        <div className="text-center space-y-4">
          <div className="text-6xl my-4">🏔️</div>
          <p>
            修仙界广袤无垠，机缘与危机并存。
            <br />
            道友可愿前往，体悟一段未知的旅程？
          </p>
        </div>
      </InkCard>
      <InkSection title="选择秘境">
        <DungeonMapSelector
          selectedNode={selectedNode ?? null}
          onStart={handleStart}
          isStarting={processing}
        />
      </InkSection>
      <p className="text-center text-xs text-ink-secondary mt-2">
        * 每日仅可探索一次（体验版，不会消耗材料、获得奖励）
      </p>
    </InkPageShell>
  );
}

export default function DungeonPage() {
  return (
    <Suspense
      fallback={
        <InkPageShell title="加载中...">
          <div className="animate-pulse p-8 text-center">正在加载...</div>
        </InkPageShell>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}
