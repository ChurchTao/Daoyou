import { RetreatView } from '@app/components/feature/retreat/RetreatView';
import { Suspense } from 'react';

export default function RetreatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="animate-pulse p-8 text-center">洞府封闭中……</div></div>}>
      <RetreatView />
    </Suspense>
  );
}
