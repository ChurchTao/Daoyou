import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { useInventoryBag } from '@app/lib/resources/bag';
import { resolveGameScene } from '@app/lib/router/routeTitle';
import { useStory } from '@app/lib/story/useStory';
import { useLocation, useMatches } from 'react-router';

function matchesLocation(target: URL, current: URL) {
  return (
    target.pathname.replace(/\/$/, '') ===
      current.pathname.replace(/\/$/, '') &&
    [...target.searchParams].every(
      ([key, value]) =>
        key === 'guide' ||
        key === 'item' ||
        current.searchParams.get(key) === value,
    )
  );
}

export function GameTaskIndicator({
  map,
}: {
  map?: { place: string; hint?: string };
}) {
  const { story } = useStory();
  const location = useLocation();
  const scene = resolveGameScene(useMatches());
  const origin = window.location.origin;
  const current = new URL(location.pathname + location.search, origin);
  const target =
    story && (story.prompt || map?.hint) ? new URL(story.href, origin) : null;
  const activity = story?.playHref ? new URL(story.playHref, origin) : null;
  const onSite = Boolean(target && matchesLocation(target, current));
  const inActivity = Boolean(activity && matchesLocation(activity, current));
  const related =
    onSite ||
    inActivity ||
    story?.indicatorFrom?.some((source) =>
      matchesLocation(new URL(source, origin), current),
    );
  const show =
    Boolean(map) ||
    (scene?.id !== 'cave' && related && !(story?.location && onSite));
  const params = current.searchParams;
  const inStorage =
    params.get('location') !== 'bag' &&
    (scene?.id === 'storage' || params.get('location') === 'storage');
  const itemId = show && !map ? story?.targetItem?.id : undefined;
  const bag = useInventoryBag(Boolean(itemId));

  if (!story || !target || !show) return null;

  const guide = map ? null : story.guideLesson;
  const inLesson = Boolean(guide && params.get('guide') === guide);
  const actionTarget = inActivity && activity ? activity : target;
  if (!guide) actionTarget.searchParams.delete('guide');
  const href = actionTarget.pathname + actionTarget.search + actionTarget.hash;
  const item = itemId
    ? bag.data?.items.find((entry) => entry.id === itemId)
    : undefined;
  const missing =
    itemId &&
    bag.data &&
    !bag.isRefreshing &&
    !bag.error &&
    !item &&
    !bag.data.equippedItems.some((entry) => entry.id === itemId);
  const recovery = missing ? story.targetItem?.missingAction : undefined;
  let action: { href: string; label: string } | undefined;
  let prompt = map
    ? (map.hint ?? `${map.place} · ${story.prompt}`)
    : story.prompt;
  if (missing) {
    prompt = inStorage
      ? '找到目标物品后，先取回随身物品。'
      : '目标物品不在随身物品中，可到储藏室查看。';
    if (!inStorage) {
      const storage = new URLSearchParams({
        location: 'storage',
        item: itemId,
      });
      action = { href: `${target.pathname}?${storage}`, label: '查看储藏室' };
    }
  } else if (itemId && inStorage) {
    action = { href, label: '回随身物品' };
  } else if ((onSite || inActivity) && guide) {
    action = { href, label: '查看教学' };
  } else if ((onSite || inActivity) && item && params.get('item') !== item.id) {
    action = { href, label: '定位物品' };
  }

  return (
    <aside
      aria-label="任务指示器"
      className={cn(
        'border-ink/15 text-ink bg-paper/95 mx-auto mb-2 w-fit rounded-sm border px-3 backdrop-blur-sm',
        map
          ? 'pointer-events-none max-w-full py-2 shadow-sm'
          : 'pointer-events-auto max-w-[calc(100%-2rem)] py-1.5',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5 leading-6">
        {!map ? (
          <span className="text-ink-secondary shrink-0 text-xs tracking-[0.2em]">
            {story.track === 'main' ? '主线' : '奇遇'}
          </span>
        ) : null}
        <div role="status" className="min-w-0 text-sm">
          {prompt}
          {item ? (
            <span className="text-ink-secondary">「{item.name}」</span>
          ) : null}
        </div>
        {!inLesson && action ? (
          <InkButton
            href={action.href}
            variant="secondary"
            className="min-h-11"
          >
            {action.label}
          </InkButton>
        ) : null}
        {!inLesson && recovery ? (
          <InkButton
            href={recovery.href}
            variant="secondary"
            className="min-h-11"
          >
            {recovery.label}
          </InkButton>
        ) : null}
      </div>
      {!map && story.goals.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-x-3 text-sm leading-6">
          {story.goals.map((goal) => (
            <li
              key={goal.label}
              className={cn(goal.done && 'text-ink-secondary line-through')}
            >
              {goal.label}
              {goal.done || goal.target === null ? null : (
                <span className="text-ink-secondary ml-1.5 font-mono font-semibold tracking-tight">
                  {goal.current ?? 0}/{goal.target}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
