import { GameSceneLoading } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { useDungeonViewModel } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import { Suspense, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DungeonViewRenderer } from './components/DungeonViewRenderer';
import { DungeonSceneScreen } from './dungeonScene';
import { resolveDungeonSceneDescriptor } from './dungeonSceneRegistry';

/**
 * 副本主页面内容组件
 *
 * 重构后的设计原则：
 * 1. 单一职责：仅负责数据获取和视图渲染协调
 * 2. 状态管理：使用 ViewModel Hook 统一管理所有状态
 * 3. 视图渲染：委托给 DungeonViewRenderer 处理
 */
function DungeonContent() {
  const identity = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const cultivator = identity.data?.cultivator
    ? { ...identity.data.cultivator, condition: condition.data }
    : null;
  const resource = (
    point: { current: number; max?: number } | undefined,
    authorityMax?: number,
  ) => {
    const max = authorityMax ?? point?.max ?? 0;
    const current = Math.min(max, Math.max(0, point?.current ?? 0));
    return { current, max, percent: max ? (current / max) * 100 : 0 };
  };
  const battleEntryResources = condition.data
    ? {
        hp: resource(
          condition.data.resources.hp,
          condition.data.combatV6?.maxHp,
        ),
        mp: resource(
          condition.data.resources.mp,
          condition.data.combatV6?.maxMp,
        ),
      }
    : undefined;
  const isCultivatorLoading = identity.loading || condition.loading;
  const { tasks, loading: tasksLoading } = useTaskList(cultivator?.id);
  const [searchParams] = useSearchParams();
  const preSelectedNodeId = searchParams.get('nodeId');
  const navigate = useNavigate();

  // 使用 ViewModel Hook 管理所有业务逻辑和状态
  const {
    viewState,
    processing,
    actions,
    readError,
    refreshing,
    refresh,
    dismissSettlement,
  } = useDungeonViewModel(!!cultivator, cultivator?.id, preSelectedNodeId);

  // 结算确认回调：刷新库存后跳转首页
  const handleSettlementConfirm = useCallback(() => {
    dismissSettlement();
    navigate('/game');
  }, [navigate, dismissSettlement]);

  // 修正加载状态：ViewModel 内部已经处理了副本状态的加载
  // 这里只需要处理用户信息的加载
  if ((isCultivatorLoading && !cultivator) || tasksLoading || !tasks) {
    const descriptor = resolveDungeonSceneDescriptor('loading');
    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <GameSceneLoading message={descriptor.loadingMessage} />
      </DungeonSceneScreen>
    );
  }

  // 委托给视图渲染器
  return (
    <>
      {readError ? (
        <div className="mx-auto w-full max-w-3xl p-4" role="alert">
          <InkNotice tone="warning">{readError}</InkNotice>
          <InkButton disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? '正在确认探索结果…' : '重新读取'}
          </InkButton>
        </div>
      ) : null}
      <fieldset
        className="min-w-0"
        disabled={!!readError || refreshing}
        inert={!!readError || refreshing}
      >
        {readError && viewState.type === 'map_selection' ? (
          <p className="p-4 text-center">探索状态暂不可用</p>
        ) : (
          <DungeonViewRenderer
            viewState={viewState}
            cultivator={cultivator}
            displayResources={battleEntryResources}
            tasks={tasks}
            processing={processing}
            actions={actions}
            onSettlementConfirm={handleSettlementConfirm}
          />
        )}
      </fieldset>
    </>
  );
}

export default function DungeonPage() {
  const descriptor = resolveDungeonSceneDescriptor('loading');

  return (
    <Suspense
      fallback={
        <DungeonSceneScreen descriptor={descriptor}>
          <GameSceneLoading message={descriptor.loadingMessage} />
        </DungeonSceneScreen>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}
