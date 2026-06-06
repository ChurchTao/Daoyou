import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { useDungeonViewModel } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { Suspense, useCallback } from 'react';
import { DungeonSceneScreen } from './dungeonScene';
import { resolveDungeonSceneDescriptor } from './dungeonSceneRegistry';
import { DungeonViewRenderer } from './components/DungeonViewRenderer';
import { useNavigate, useSearchParams } from 'react-router';

/**
 * 副本主页面内容组件
 *
 * 重构后的设计原则：
 * 1. 单一职责：仅负责数据获取和视图渲染协调
 * 2. 状态管理：使用 ViewModel Hook 统一管理所有状态
 * 3. 视图渲染：委托给 DungeonViewRenderer 处理
 */
function DungeonContent() {
  const {
    cultivator,
    display,
    isLoading: isCultivatorLoading,
    refresh,
  } = useCultivator();
  const { tasks } = useTaskList(cultivator?.id);
  const [searchParams] = useSearchParams();
  const preSelectedNodeId = searchParams.get('nodeId');
  const navigate = useNavigate();

  // 使用 ViewModel Hook 管理所有业务逻辑和状态
  const { viewState, processing, actions } = useDungeonViewModel(
    !!cultivator,
    cultivator?.id,
    preSelectedNodeId,
  );

  // 结算确认回调：刷新库存后跳转首页
  const handleSettlementConfirm = useCallback(async () => {
    await refresh();
    navigate('/game');
  }, [navigate, refresh]);

  // 修正加载状态：ViewModel 内部已经处理了副本状态的加载
  // 这里只需要处理用户信息的加载
  if (isCultivatorLoading) {
    const descriptor = resolveDungeonSceneDescriptor('loading');
    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <div className="text-center">
          <p className="loading-tip">{descriptor.loadingMessage}</p>
        </div>
      </DungeonSceneScreen>
    );
  }

  // 委托给视图渲染器
  return (
    <DungeonViewRenderer
      viewState={viewState}
      cultivator={cultivator}
      displayResources={display?.resources}
      tasks={tasks}
      processing={processing}
      actions={actions}
      onSettlementConfirm={handleSettlementConfirm}
    />
  );
}

export default function DungeonPage() {
  const descriptor = resolveDungeonSceneDescriptor('loading');

  return (
    <Suspense
      fallback={
        <DungeonSceneScreen descriptor={descriptor}>
          <div className="text-center">
            <p className="loading-tip">{descriptor.loadingMessage}</p>
          </div>
        </DungeonSceneScreen>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}
