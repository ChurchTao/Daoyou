import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@shared/lib/cn';
import { getAtlasRegion } from '@shared/lib/game/mapAtlas';
import {
  ATLAS_CATEGORY_IDS,
  getAtlasCategory,
  type AtlasCategory,
} from '@shared/lib/game/mapAtlasCategories';
import type { WorldMapLocation } from '@shared/lib/game/mapSystem';
import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { ATLAS_CATEGORY_STYLE } from './atlasMarkerStyle';

const control =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors hover:bg-ink/10 active:bg-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/60';

export function AtlasToolbar({
  toolbarRef,
  popoverRef,
  regionName,
  hasRegion,
  canFilter,
  categories,
  regionLocations,
  results,
  query,
  searchAll,
  searchOpen,
  filterOpen,
  onClose,
  onUp,
  onQuery,
  onSearchAll,
  onSearchOpen,
  onFilterOpen,
  onDismiss,
  onCategories,
  onSelect,
}: {
  toolbarRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  regionName: string;
  hasRegion: boolean;
  canFilter: boolean;
  categories: AtlasCategory[];
  regionLocations: WorldMapLocation[];
  results: WorldMapLocation[];
  query: string;
  searchAll: boolean;
  searchOpen: boolean;
  filterOpen: boolean;
  onClose: () => void;
  onUp: () => void;
  onQuery: (value: string) => void;
  onSearchAll: (value: boolean) => void;
  onSearchOpen: () => void;
  onFilterOpen: () => void;
  onDismiss: () => void;
  onCategories: (types: AtlasCategory[]) => void;
  onSelect: (id: string) => void;
}) {
  const searchResults = useRef<HTMLUListElement>(null);
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!searchOpen && !filterOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolbarRef.current?.contains(event.target)
      )
        dismiss();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [searchOpen, filterOpen, toolbarRef]);

  return (
    <header
      ref={toolbarRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-2 pt-[calc(env(safe-area-inset-top)+0.65rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)]"
    >
      <nav
        aria-label="地图导航"
        className="bg-paper/95 border-ink/15 pointer-events-auto flex w-fit items-center rounded-sm border p-0.5 shadow-sm backdrop-blur-sm"
      >
        <button type="button" onClick={onClose} className={control}>
          <GameIcon value="×" className="text-xl" />
          关闭地图
        </button>
        {hasRegion ? (
          <>
            <span className="bg-ink/15 h-5 w-px" aria-hidden="true" />
            <button type="button" onClick={onUp} className={control}>
              <GameIcon value="←" className="text-base" />
              返回上层
            </button>
          </>
        ) : null}
      </nav>

      <div className="pointer-events-auto relative ml-auto max-w-full">
        <div className="bg-paper/95 border-ink/15 flex min-h-12 items-center gap-1 rounded-sm border p-1 shadow-sm backdrop-blur-sm">
          <span
            className="max-w-24 shrink-0 truncate px-1.5 text-sm font-semibold"
            title={regionName}
          >
            {regionName}
          </span>
          <div
            className={`border-ink/20 focus-within:border-ink/60 flex min-w-0 items-center rounded-sm border bg-white/45 transition-colors focus-within:bg-white/75 ${searchOpen ? 'border-ink/50' : ''}`}
          >
            <label htmlFor="atlas-location-search" className="sr-only">
              搜索地点
            </label>
            <input
              id="atlas-location-search"
              type="search"
              value={query}
              placeholder="搜索地点"
              aria-expanded={searchOpen}
              aria-controls="atlas-search-results"
              autoComplete="off"
              onFocus={onSearchOpen}
              onChange={(event) => {
                if (searchResults.current) searchResults.current.scrollTop = 0;
                onQuery(event.target.value);
                onSearchOpen();
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  searchResults.current
                    ?.querySelector<HTMLButtonElement>('button')
                    ?.focus();
                }
              }}
              className="text-ink placeholder:text-ink-secondary min-h-10 w-24 min-w-0 bg-transparent px-2 text-sm outline-none sm:w-36"
            />
          </div>
          {canFilter ? (
            <button
              type="button"
              aria-expanded={filterOpen}
              aria-controls="atlas-type-filter"
              onClick={onFilterOpen}
              className={cn(
                control,
                `shrink-0 px-2 ${filterOpen ? 'bg-ink text-paper hover:bg-ink/90 active:bg-ink/80' : categories.length ? 'bg-ink/10' : ''}`,
              )}
            >
              {categories.length ? `类型 · ${categories.length}` : '全部类型'}
              <GameIcon value={filterOpen ? '▴' : '▾'} className="text-xs" />
            </button>
          ) : null}
        </div>

        {searchOpen || (filterOpen && canFilter) ? (
          <div
            ref={popoverRef}
            className="bg-paper/98 border-ink/20 absolute top-[calc(100%+0.5rem)] right-0 w-[min(21rem,calc(100vw-1.5rem))] rounded-sm border shadow-lg backdrop-blur-md"
          >
            {filterOpen ? (
              <div
                id="atlas-type-filter"
                role="group"
                aria-label="地点类型，可多选"
                className="max-h-[min(26rem,55dvh)] overflow-y-auto p-2"
              >
                <div className="text-ink-secondary flex items-center justify-between px-2 pb-1 text-xs">
                  <span>地点类型 · 可多选</span>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className={cn(control, `px-2`)}
                  >
                    完成
                  </button>
                </div>
                <button
                  type="button"
                  aria-pressed={!categories.length}
                  onClick={() => onCategories([])}
                  className={cn(
                    control,
                    `w-full justify-between ${!categories.length ? 'bg-ink/8 font-semibold' : ''}`,
                  )}
                >
                  <span>全部地点</span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs">
                      {regionLocations.length}
                    </span>
                    <span className="w-4">{!categories.length ? '✓' : ''}</span>
                  </span>
                </button>
                {ATLAS_CATEGORY_IDS.map((category) => {
                  const style = ATLAS_CATEGORY_STYLE[category];
                  const count = regionLocations.filter(
                    (location) => getAtlasCategory(location) === category,
                  ).length;
                  const active = categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={active}
                      disabled={!count && !active}
                      onClick={() =>
                        onCategories(
                          active
                            ? categories.filter((type) => type !== category)
                            : [...categories, category],
                        )
                      }
                      className={cn(
                        control,
                        `w-full justify-start disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${active ? 'bg-ink/8 font-semibold' : ''}`,
                      )}
                    >
                      <GameIcon value={style.icon} className="text-[2rem]" />
                      <span className="flex-1 text-left">{style.name}</span>
                      <span className="font-mono text-xs">{count}</span>
                      <span
                        className={`ml-2 flex size-4 items-center justify-center rounded-[2px] border text-xs ${active ? 'bg-ink border-ink text-paper' : 'border-ink/30'}`}
                        aria-hidden="true"
                      >
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2">
                <div className="text-ink-secondary flex items-center justify-between px-2 text-xs">
                  <span>
                    {query.trim()
                      ? '查找结果'
                      : searchAll || !hasRegion
                        ? '全部地点'
                        : '当前区域'}{' '}
                    · <span className="font-mono">{results.length}</span>
                  </span>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className={cn(control, `px-2`)}
                  >
                    收起
                  </button>
                </div>
                <ul
                  ref={searchResults}
                  id="atlas-search-results"
                  className="max-h-[min(22rem,42dvh)] overflow-y-auto overscroll-contain"
                  onKeyDown={(event) => {
                    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                    const buttons = Array.from(
                      searchResults.current?.querySelectorAll<HTMLButtonElement>(
                        'button',
                      ) ?? [],
                    );
                    const index = buttons.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    if (index < 0) return;
                    event.preventDefault();
                    buttons[
                      (index +
                        (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
                        buttons.length
                    ]?.focus();
                  }}
                >
                  {results.map((location) => (
                    <li key={location.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(location.id)}
                        className={cn(
                          control,
                          `w-full justify-start py-1.5 text-left`,
                        )}
                      >
                        <GameIcon
                          value={
                            ATLAS_CATEGORY_STYLE[getAtlasCategory(location)]
                              .icon
                          }
                          className="text-[2rem]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block">{location.name}</span>
                          <span className="text-ink-secondary block text-xs">
                            {getAtlasRegion(location)?.name} ·{' '}
                            {
                              ATLAS_CATEGORY_STYLE[getAtlasCategory(location)]
                                .name
                            }
                          </span>
                        </span>
                        <GameIcon value="›" className="text-ink-secondary" />
                      </button>
                    </li>
                  ))}
                </ul>
                {!results.length ? (
                  <p className="text-ink-secondary px-2 py-4 text-sm">
                    没有找到符合条件的地点。
                  </p>
                ) : null}
                <label className="border-ink/10 mt-1 flex min-h-11 cursor-pointer items-center gap-2 border-t px-2 text-xs">
                  <input
                    type="checkbox"
                    checked={searchAll}
                    onChange={(event) => onSearchAll(event.target.checked)}
                    className="accent-ink size-4"
                  />
                  搜索所有地点（忽略类型筛选）
                </label>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
