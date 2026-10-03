import { GameSceneLoading } from '@app/components/game-shell';
import { Suspense } from 'react';
import { HomeView } from './components/HomeView';

/**
 * 首页
 * 重构后仅保留路由壳子
 */
export default function HomePage() {
  return (
    <Suspense fallback={<GameSceneLoading message="正在进入洞府……" />}>
      <HomeView />
    </Suspense>
  );
}
