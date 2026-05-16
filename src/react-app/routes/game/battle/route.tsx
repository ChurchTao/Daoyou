import { GameImmersiveLoading } from '@app/components/game-shell';
import { Suspense } from 'react';
import { BattleView } from './components/BattleView';

/**
 * 对战播报页
 * 重构后仅保留路由壳子
 */
export default function BattlePage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="战局演算中……" />}>
      <BattleView />
    </Suspense>
  );
}
