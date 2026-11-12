import { InkButton } from '@app/components/ui/InkButton';
import { storyLeadsElsewhere } from '@app/lib/story/elsewhere';
import { useStory } from '@app/lib/story/useStory';
import { useLocation, useSearchParams } from 'react-router';

/**
 * 地图这类铺满屏的页面上没有正文可以写主线。
 * 新手期主线的下一步在别处时，在底边留一张字条把人领过去。
 */
export function StoryNudge() {
  const { story } = useStory();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  // 教学还在讲的时候不插话。
  if (params.has('guide')) return null;
  if (!storyLeadsElsewhere(story, pathname)) return null;

  return (
    <p
      role="status"
      className="bg-paper text-ink animate-fade-in absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-x-3 px-5 py-2 text-base leading-8 shadow-[0_10px_30px_rgba(44,24,16,0.18)]"
    >
      {story.prompt}
      <InkButton href={story.href} variant="primary">
        过去
      </InkButton>
    </p>
  );
}
