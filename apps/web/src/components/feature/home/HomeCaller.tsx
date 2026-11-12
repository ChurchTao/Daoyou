import { HomeAct, HomeLabel } from '@app/components/feature/home/HomeAct';
import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import { storyCastFace } from '@app/lib/story/performanceContext';
import type { PerformanceContext } from '@daoyou/game-domain/performance';
import type { StoryView } from '@daoyou/game-domain/story';

function fill(text: string, context: PerformanceContext) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => context[key] ?? '');
}

/**
 * 主线眼下的事。有人等着，就是那个人带着一句话找上门来；
 * 没有人，就只写眼下该做什么。
 */
export function HomeCaller({
  story,
  context,
  sectId,
}: {
  story: StoryView;
  context: PerformanceContext;
  sectId?: string | null;
}) {
  const hail = story.hail;
  const face = hail
    ? (hail.portrait ?? storyCastFace(hail.by, sectId))
    : undefined;
  const act = story.prompt.replace(/[。！]$/, '');

  return (
    <section data-guide="home.story">
      <HomeLabel>{hail ? '来人' : '眼下'}</HomeLabel>
      {hail ? (
        <div className="mb-2 flex items-start gap-4">
          {face ? (
            <GameIcon
              purpose="artwork"
              value={face}
              className="size-[4.5rem] shrink-0"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-ink-secondary text-sm tracking-[0.18em]">
              {fill(hail.by, context)}
            </p>
            <p className="text-ink text-xl leading-9">「{hail.line}」</p>
          </div>
        </div>
      ) : null}
      <HomeAct href={story.href} lead={act} />
      {story.goals.length > 0 ? (
        <ul className="pl-7">
          {story.goals.map((goal) => (
            <li
              key={goal.label}
              className={cn(
                'flex items-baseline gap-3 text-base leading-8',
                goal.done ? 'text-ink-secondary line-through' : 'text-ink',
              )}
            >
              <span className="min-w-0">{goal.label}</span>
              {goal.done || goal.target === null ? null : (
                <span className="text-ink-secondary font-mono text-sm font-semibold tracking-tight">
                  {goal.current ?? 0}/{goal.target}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-wood mt-1 pl-7 text-sm tracking-[0.12em]">
        主线 · {story.chapterTitle}
      </p>
    </section>
  );
}
