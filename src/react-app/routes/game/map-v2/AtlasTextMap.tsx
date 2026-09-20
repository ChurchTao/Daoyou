import type { MapNodeAction } from '@app/components/feature/map/mapActions';
import { GameIcon } from '@app/components/ui/GameIcon';
import { ATLAS_REGIONS, hasAtlasMap } from '@shared/lib/game/mapAtlas';
import {
  ATLAS_CATEGORY_IDS,
  getAtlasCategory,
} from '@shared/lib/game/mapAtlasCategories';
import type { WorldMapLocation } from '@shared/lib/game/mapSystem';
import { useEffect, useRef } from 'react';
import { AtlasNodePanel } from './AtlasNodePanel';
import { ATLAS_CATEGORY_STYLE } from './atlasMarkerStyle';

const row =
  'flex min-h-12 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-ink/8 active:bg-ink/15 focus-visible:outline-2 focus-visible:outline-ink/60';

export function AtlasTextMap({
  regionId,
  locations,
  selected,
  actions,
  onRegion,
  onSelect,
  onClose,
}: {
  regionId?: string;
  locations: WorldMapLocation[];
  selected?: WorldMapLocation;
  actions: MapNodeAction[];
  onRegion: (id: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const group = selectedButton.current?.closest('details');
    if (group) group.open = true;
    selectedButton.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);
  return (
    <div className="absolute inset-x-0 top-[var(--atlas-toolbar-bottom)] bottom-0 flex min-h-0 gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:gap-5">
      <nav
        aria-label="选择区域"
        className={`${regionId ? 'hidden md:block' : ''} bg-paper/90 w-full overflow-y-auto rounded-sm p-2 md:w-52 md:shrink-0`}
      >
        <p className="text-ink-secondary px-3 py-2 text-xs">人界 · 选择区域</p>
        {ATLAS_REGIONS.map((region) => (
          <button
            key={region.id}
            type="button"
            disabled={!hasAtlasMap(region.id)}
            aria-current={regionId === region.id ? 'location' : undefined}
            onClick={() => onRegion(region.id)}
            className={`${row} disabled:cursor-not-allowed disabled:opacity-45 ${regionId === region.id ? 'bg-ink/10 font-semibold' : ''}`}
          >
            <GameIcon value="icon:map-landmark" className="shrink-0 text-3xl" />
            <span className="flex-1">{region.name}</span>
            <span className="text-ink-secondary text-xs">
              {hasAtlasMap(region.id) ? '›' : '未开放'}
            </span>
          </button>
        ))}
      </nav>
      {regionId ? (
        <section
          aria-label="区域地点"
          key={regionId}
          className="bg-paper/90 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-sm p-2 md:px-4"
        >
          <p className="text-ink-secondary px-3 py-2 text-xs">
            选择类型下的地点，展开详情与操作
          </p>
          {!locations.length ? (
            <p role="status" className="px-3 py-4 text-sm">
              当前区域没有符合类型的地点，可在右上角调整筛选。
            </p>
          ) : null}
          {ATLAS_CATEGORY_IDS.map((category) => {
            const items = locations.filter(
              (location) => getAtlasCategory(location) === category,
            );
            if (!items.length) return null;
            const style = ATLAS_CATEGORY_STYLE[category];
            return (
              <details
                key={category}
                open
                className="border-ink/10 border-b last:border-0"
              >
                <summary className="hover:bg-ink/5 min-h-12 cursor-pointer rounded-sm px-3 py-2 text-sm focus-visible:outline-2">
                  <span
                    className="ml-1 inline-flex items-center gap-2 align-middle"
                    style={{
                      color: `#${style.color.toString(16).padStart(6, '0')}`,
                    }}
                  >
                    <GameIcon value={style.icon} className="text-3xl" />
                    {style.name}
                    <span className="text-ink-secondary font-mono text-xs">
                      {items.length}
                    </span>
                  </span>
                </summary>
                <ul className="pb-2 pl-3 md:pl-6">
                  {items.map((location) => {
                    const active = selected?.id === location.id;
                    return (
                      <li key={location.id}>
                        <button
                          type="button"
                          ref={active ? selectedButton : undefined}
                          aria-expanded={active}
                          aria-controls={
                            active ? `text-map-node-${location.id}` : undefined
                          }
                          onClick={() =>
                            active ? onClose() : onSelect(location.id)
                          }
                          className={`${row} ${active ? 'text-crimson bg-ink/8 font-semibold' : ''}`}
                        >
                          <GameIcon
                            value={style.icon}
                            className="shrink-0 text-3xl"
                          />
                          <span className="flex-1">{location.name}</span>
                          <span aria-hidden="true">{active ? '▾' : '›'}</span>
                        </button>
                        {active ? (
                          <section
                            id={`text-map-node-${location.id}`}
                            aria-label={`${location.name}详情`}
                            className="border-crimson/40 my-2 ml-4 flex flex-col border-l-2 px-4 pb-3"
                          >
                            <AtlasNodePanel
                              location={location}
                              actions={actions}
                              onClose={onClose}
                            />
                          </section>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </section>
      ) : (
        <p className="text-ink-secondary hidden flex-1 self-center text-center text-sm md:block">
          从左侧选择一处区域，浏览当地地点。
        </p>
      )}
    </div>
  );
}
