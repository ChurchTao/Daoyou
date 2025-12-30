'use client';

import { InkPageShell } from '@/components/InkLayout';
import { useDungeonViewModel } from '@/lib/hooks/dungeon/useDungeonViewModel';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DungeonViewRenderer } from './components/DungeonViewRenderer';

/**
 * 副本主页面内容组件
 *
 * 重构后的设计原则：
 * 1. 单一职责：仅负责数据获取和视图渲染协调
 * 2. 状态管理：使用 ViewModel Hook 统一管理所有状态
 * 3. 视图渲染：委托给 DungeonViewRenderer 处理
 */
function DungeonContent() {
  const { cultivator, isLoading: isCultivatorLoading } = useCultivatorBundle();
  const searchParams = useSearchParams();
  const preSelectedNodeId = searchParams.get('nodeId');

  // 使用 ViewModel Hook 管理所有业务逻辑和状态
  const { viewState, processing, actions } = useDungeonViewModel(
    cultivator?.id,
    preSelectedNodeId,
  );

  // 修正加载状态：ViewModel 内部已经处理了副本状态的加载
  // 这里只需要处理用户信息的加载
  if (isCultivatorLoading) {
    return (
      <InkPageShell title="推演中...">
        <div className="flex justify-center p-12">
          <p className="animate-pulse">天机混沌，正在解析...</p>
        </div>
      </InkPageShell>
    );
  }

  // 委托给视图渲染器
  return (
    <DungeonViewRenderer
      viewState={viewState}
      cultivator={cultivator}
      processing={processing}
      actions={actions}
    />
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
