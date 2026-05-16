import { Suspense } from 'react';
import { InventoryView } from './components/InventoryView';

/**
 * 储物袋页面
 * 重构后仅保留路由壳子
 */
export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="animate-pulse p-8 text-center">储物袋开启中……</div>
        </div>
      }
    >
      <InventoryView />
    </Suspense>
  );
}
