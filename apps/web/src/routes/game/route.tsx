import { GameSceneLoading } from '@app/components/game-shell/GameSceneFrame';
import { useStory } from '@app/lib/story/useStory';
import { storySceneOpen } from '@daoyou/game-domain/story/gates';
import { Suspense } from 'react';
import { Navigate } from 'react-router';
import { HomeView } from './components/HomeView';

/**
 * 首页
 * 重构后仅保留路由壳子
 */
export default function HomePage() {
  const { story } = useStory();
  if (
    story?.location &&
    story.location.kind !== 'cave' &&
    !storySceneOpen(story.unlocked, 'map')
  ) {
    return <Navigate to={story.resumeHref ?? story.href} replace />;
  }
  return (
    <Suspense fallback={<GameSceneLoading message="正在进入洞府……" />}>
      <HomeView />
    </Suspense>
  );
}
