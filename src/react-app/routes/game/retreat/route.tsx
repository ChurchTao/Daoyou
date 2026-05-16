import { Suspense } from 'react';
import { RetreatView } from './components/RetreatView';

/**
 * 洞府页面
 * 重构后仅保留路由壳子
 */
export default function RetreatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="animate-pulse p-8 text-center">洞府封闭中……</div>
        </div>
      }
    >
      <RetreatView />
    </Suspense>
  );
}
