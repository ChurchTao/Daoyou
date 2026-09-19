import type { MapNodeDetailAction } from '@app/components/feature/map/MapNodeDetail';
import { WildNodePreview } from '@app/components/feature/map/WildNodePreview';
import { InkButton } from '@app/components/ui/InkButton';
import { getAtlasCategory } from '@shared/lib/game/mapAtlasCategories';
import {
  resolveDungeonMapConfig,
  type WorldMapLocation,
} from '@shared/lib/game/mapSystem';
import { AtlasNodeKinds } from './AtlasNodeKinds';

/** One nonmodal panel owns both location information and its single gameplay entry. */
export function AtlasNodePanel({
  location,
  actions,
  onClose,
}: {
  location: WorldMapLocation;
  actions: MapNodeDetailAction[];
  onClose: () => void;
}) {
  const category = getAtlasCategory(location);
  const dungeon =
    category === 'dungeon' && !('sect_id' in location)
      ? resolveDungeonMapConfig(location)
      : null;
  return (
    <>
      <div className="shrink-0">
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
          {actions.map((action) => (
            <InkButton
              key={action.key}
              className="min-h-11"
              variant="primary"
              onClick={action.onClick}
            >
              {action.label}
            </InkButton>
          ))}
        </div>
      ) : null}
    </>
  );
}
