import { InkButton } from '@app/components/ui/InkButton';
import { resolveGameScene } from '@app/lib/router/routeTitle';
import { useStory } from '@app/lib/story/useStory';
import { storySceneOpen } from '@daoyou/game-domain/story/gates';
import type { ReactNode } from 'react';
import { useMatches } from 'react-router';

/**
 * 页面的门：主线还没带到的地方，直接输地址也进不去。
 * 开没开只问入口总表，各个页面不用自己判断。
 */
export function SceneGate({ children }: { children: ReactNode }) {
  const scene = resolveGameScene(useMatches());
  const { story } = useStory();
  if (storySceneOpen(story?.unlocked, scene?.id)) return children;

  return (
    <div className="bg-paper text-ink flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg leading-9">你还不认得去这里的路。</p>
      <p className="text-ink-secondary text-sm leading-7">
        跟着主线走，走到了自然会开。
      </p>
      <InkButton href="/game" variant="primary">
        回洞府
      </InkButton>
    </div>
  );
}
