import { GameSceneLoading } from '@app/components/game-shell';
import { Suspense } from 'react';
import { SkillsView } from './components/SkillsView';

/**
 * 神通页面
 * 重构后仅保留路由壳子
 */
export default function SkillsPage() {
  return (
    <Suspense fallback={<GameSceneLoading message="神通卷轴徐徐展开……" />}>
      <SkillsView />
    </Suspense>
  );
}
