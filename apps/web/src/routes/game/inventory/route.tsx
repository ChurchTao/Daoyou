import { GameSceneLoading } from '@app/components/game-shell';
import { Suspense } from 'react';
import { InventoryView } from './components/InventoryView';

/**
 * 储物袋页面
 * 重构后仅保留路由壳子
 */
export default function InventoryPage() {
  return (
    <Suspense fallback={<GameSceneLoading message="储物袋开启中……" />}>
      <InventoryView />
    </Suspense>
  );
}
