import type { MapNodeAction } from '@app/components/feature/map/mapActions';
import { WildNodePreview } from '@app/components/feature/map/WildNodePreview';
import { InkButton } from '@app/components/ui/InkButton';
import { useStory } from '@app/lib/story/useStory';
import { storyGateOpen } from '@daoyou/game-domain/story/gates';
import { type WorldMapLocation } from '@daoyou/game-domain/world/map';
import { getAtlasCategory } from '@daoyou/game-rules/world/atlas';
import { resolveDungeonMapConfig } from '@daoyou/game-rules/world/dungeon';
import { AtlasNodeKinds } from './AtlasNodeKinds';

export function AtlasNodePanel({
  location,
  actions,
  onClose,
}: {
  location: WorldMapLocation;
  actions: MapNodeAction[];
  onClose?: () => void;
}) {
  const category = getAtlasCategory(location);
  // 新手期舆图上什么都看得见，但主线还没带到的秘境和坊市先不让进。
  const unlocked = useStory().story?.unlocked;
  const availableActions = actions.filter(
    (action) => !action.gate || storyGateOpen(unlocked, action.gate),
  );
  const dungeon =
    category === 'dungeon' && !('sect_id' in location)
      ? resolveDungeonMapConfig(location)
      : null;
  return (
    <>
      <div className="shrink-0">
        {onClose ? (
          <div className="flex items-start justify-between gap-3">
            <p
              aria-live="polite"
              className="text-crimson pt-2 text-base font-semibold"
            >
              {location.name}
            </p>
            <InkButton className="min-h-11 shrink-0" onClick={onClose}>
              收起
            </InkButton>
          </div>
        ) : null}
        <AtlasNodeKinds location={location} />
      </div>
      <div className="min-h-0 overflow-y-auto">
        <p className="mt-2 text-sm leading-6">{location.description}</p>
        {'realm_requirement' in location && category !== 'landmark' ? (
          <p className="text-ink-secondary mt-2 text-xs">
            {category === 'wild' ? '开放境界' : '推荐境界'}：
            {location.realm_requirement}
            {dungeon
              ? ` · ${dungeon.difficultyLabel} · 奖励加成 +${Math.max(0, Math.round((dungeon.rewardBonus - 1) * 100))}%`
              : ''}
          </p>
        ) : null}
        {category === 'wild' ? <WildNodePreview nodeId={location.id} /> : null}
        <div className="text-ink-secondary mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {location.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      {actions.length ? (
        <div className="border-ink/10 mt-3 shrink-0 border-t pt-2">
          {availableActions.map((action) => (
            <InkButton
              key={action.key}
              className="min-h-11"
              variant={action.variant}
              onClick={action.onClick}
            >
              {action.label}
            </InkButton>
          ))}
          {availableActions.length < actions.length ? (
            <p className="text-ink-secondary mt-1 text-sm leading-6">
              跟随主线解锁{category === 'market' ? '坊市' : '历练'}。
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
