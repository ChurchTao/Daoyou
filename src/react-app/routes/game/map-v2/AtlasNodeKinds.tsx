import { GameIcon } from '@app/components/ui/GameIcon';
import { getAtlasCategory } from '@shared/lib/game/mapAtlasCategories';
import type { WorldMapLocation } from '@shared/lib/game/mapSystem';
import { ATLAS_CATEGORY_STYLE } from './atlasMarkerStyle';

export function AtlasNodeKinds({ location }: { location: WorldMapLocation }) {
  const style = ATLAS_CATEGORY_STYLE[getAtlasCategory(location)];
  return (
    <span className="text-ink-secondary inline-flex items-center gap-1.5 text-xs">
      <GameIcon value={style.icon} className="text-2xl" />
      {style.name}
    </span>
  );
}
