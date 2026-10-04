import { RetreatView } from '@app/components/feature/retreat/RetreatView';
import { GameSceneLoading } from '@app/components/game-shell';
import { Suspense } from 'react';

export default function RetreatPage() {
  return (
    <Suspense fallback={<GameSceneLoading message="洞府封闭中……" />}>
      <RetreatView />
    </Suspense>
  );
}
