import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import { useInventoryBag } from '@app/lib/resources/bag';
import { usePlayerSession } from '@app/lib/resources/player';
import { resolveGameScene } from '@app/lib/router/routeTitle';
import { storyMapPlaceName } from '@app/lib/story/storyMapPlaceName';
import { useStory } from '@app/lib/story/useStory';
import { storySceneOpen } from '@daoyou/game-domain/story/gates';
import { useLocation, useMatches } from 'react-router';

function matchesPath(target: URL, current: URL) {
  return (
    target.pathname.replace(/\/$/, '') === current.pathname.replace(/\/$/, '')
  );
}

function matchesLocation(target: URL, current: URL) {
  return (
    matchesPath(target, current) &&
    [...target.searchParams].every(
      ([key, value]) =>
        key === 'guide' ||
        key === 'item' ||
        current.searchParams.get(key) === value,
    )
  );
}

export function GameTaskIndicator() {
  const { story } = useStory();
  const location = useLocation();
  const scene = resolveGameScene(useMatches());
  const origin = window.location.origin;
  const current = new URL(location.pathname + location.search, origin);
  const params = current.searchParams;
  const place = story?.location;
  const target =
    story && (story.prompt || story.passage?.hint)
      ? new URL(story.href, origin)
      : null;
  const activity = story?.playHref ? new URL(story.playHref, origin) : null;
  const onSite = Boolean(target && matchesLocation(target, current));
  const inActivity = Boolean(activity && matchesLocation(activity, current));
  const inTargetMap =
    !!target &&
    matchesPath(target, current) &&
    (place?.kind === 'sect' ||
      (place?.kind === 'area' && params.get('area') === place.areaId));
  const directions = inTargetMap && onSite ? story?.passage?.hint : undefined;
  const related =
    onSite ||
    inActivity ||
    inTargetMap ||
    story?.indicatorFrom?.some((source) =>
      matchesLocation(new URL(source, origin), current),
    );
  const show =
    scene?.id !== 'cave' && related && (!place || !onSite || !!directions);
  const canLinkToPlace =
    show &&
    !onSite &&
    !(activity && matchesPath(activity, current)) &&
    !!place &&
    !story?.passage?.hint &&
    (place.kind !== 'sect' || storySceneOpen(story?.unlocked, 'sect'));
  const player = usePlayerSession(canLinkToPlace && place?.kind === 'sect');
  const inStorage =
    params.get('location') !== 'bag' &&
    (scene?.id === 'storage' || params.get('location') === 'storage');
  const itemId = show ? story?.targetItem?.id : undefined;
  const bag = useInventoryBag(Boolean(itemId));

  if (!story || !target || !show) return null;

  const guide = story.guideLesson;
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
  let prompt = directions ?? story.prompt;
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
  } else if (canLinkToPlace) {
    const name =
      place?.kind === 'cave'
        ? '洞府'
        : storyMapPlaceName(place, player.data?.activeCultivator?.sectId);
    if (name) {
      action = {
        href: target.pathname + target.search + target.hash,
        label: `前往${name}`,
      };
    }
  }

  return (
    <aside
      aria-label="任务指示器"
      className="border-ink/15 text-ink bg-paper/95 pointer-events-auto mx-auto mb-2 w-fit max-w-[calc(100%-2rem)] rounded-sm border px-3 py-1.5 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5 leading-6">
        <span className="text-ink-secondary shrink-0 text-xs tracking-[0.2em]">
          {story.track === 'main' ? '主线' : '奇遇'}
        </span>
        <div role="status" className="min-w-0 text-sm">
          {prompt}
          {item ? (
            <span className="text-ink-secondary">「{item.name}」</span>
          ) : null}
        </div>
        {!inLesson && action ? (
          <InkButton href={action.href} variant="primary" className="min-h-11">
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
      {story.goals.length > 0 ? (
        <ul
          aria-live="polite"
          className="flex flex-wrap justify-center gap-x-3 text-sm leading-6"
        >
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
