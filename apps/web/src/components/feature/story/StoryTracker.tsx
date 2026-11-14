import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { useStory } from '@app/lib/story/useStory';
import type { StoryView } from '@daoyou/game-domain/story';
import { useLocation, useSearchParams } from 'react-router';

/** 主线的下一步是不是就在眼下这一页办。 */
function here(story: StoryView, pathname: string) {
  return new URL(story.href, 'http://story.local').pathname === pathname;
}

/**
 * 主线追踪：全游戏只有这一个部件告诉玩家主线眼下要做什么、做到哪了。
 * page 写在常规页面正文的最上面；slip 是铺满屏的页面底边的一张字条。
 * 洞府有自己更完整的写法（来人），演出和剧情战页面本身就是主线，都不用它。
 */
export function StoryTracker({
  placement,
  sceneId,
}: {
  placement: 'page' | 'slip';
  /** 眼下这一页的场景编号。常驻幕只在自己那一页提一句。 */
  sceneId?: string;
}) {
  const { story } = useStory();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  // 教学还在讲的时候不插话。
  if (!story?.prompt || params.has('guide')) return null;
  if (story.kind === 'life' && story.scene !== sceneId) return null;
  const onSite = here(story, pathname);
  // 字条只负责把人领过去；人已经在地方了就不贴。
  if (placement === 'slip' && onSite && story.goals.length === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        'text-ink flex flex-wrap items-baseline gap-x-4 gap-y-1 leading-8',
        placement === 'page'
          ? 'border-ink/10 mb-4 border-b border-dashed pb-3 text-base'
          : 'bg-paper animate-fade-in absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 mx-auto w-fit max-w-[calc(100%-2rem)] justify-center px-5 py-2 text-base shadow-[0_10px_30px_rgba(44,24,16,0.18)]',
      )}
    >
      <span className="text-wood shrink-0 text-xs tracking-[0.28em]">主线</span>
      <span className="min-w-0">{story.prompt}</span>
      {story.goals.map((goal) => (
        <span
          key={goal.label}
          className={cn(
            'text-sm whitespace-nowrap',
            goal.done ? 'text-ink-secondary line-through' : 'text-ink',
          )}
        >
          {goal.label}
          {goal.done || goal.target === null ? null : (
            <span className="text-ink-secondary ml-1.5 font-mono font-semibold tracking-tight">
              {goal.current ?? 0}/{goal.target}
            </span>
          )}
        </span>
      ))}
      {onSite ? null : (
        <InkButton href={story.href} variant="primary">
          过去
        </InkButton>
      )}
    </div>
  );
}
