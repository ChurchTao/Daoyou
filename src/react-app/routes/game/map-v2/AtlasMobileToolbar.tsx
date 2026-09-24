import { GameIcon } from '@app/components/ui/GameIcon';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { getAtlasRegion } from '@shared/lib/game/mapAtlas';
import {
  ATLAS_CATEGORY_IDS,
  getAtlasCategory,
} from '@shared/lib/game/mapAtlasCategories';
import { useEffect, useRef, useState } from 'react';
import { ATLAS_CATEGORY_STYLE } from './atlasMarkerStyle';
import type { AtlasToolbarProps } from './AtlasToolbar';

const control =
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-sm px-2 text-sm transition-colors hover:bg-ink/10 active:bg-ink/20 focus-visible:outline-2 focus-visible:outline-ink/60';

export function AtlasMobileToolbar({
  toolbarRef,
  regionName,
  hasRegion,
  canFilter,
  categories,
  results,
  query,
  searchAll,
  searchOpen,
  filterOpen,
  mapMode,
  onMapMode,
  onClose,
  onUp,
  onQuery,
  onSearchAll,
  onSearchOpen,
  onDismiss,
  onCategories,
  onSelect,
}: AtlasToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const more = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const resultsList = useRef<HTMLUListElement>(null);
  const open = searchOpen || filterOpen;
  useEffect(() => {
    if (!moreOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !more.current?.contains(event.target))
        setMoreOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [moreOpen]);

  return (
    <>
      <header
        ref={toolbarRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)]"
      >
        <nav
          aria-label="地图导航"
          className="bg-paper/95 border-ink/15 pointer-events-auto flex shrink-0 items-center rounded-sm border p-0.5 shadow-sm backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="关闭地图"
            title="关闭地图"
            onClick={onClose}
            className={control}
          >
            <GameIcon value="×" className="text-xl" />
          </button>
          {hasRegion ? (
            <>
              <span className="bg-ink/15 h-5 w-px" aria-hidden="true" />
              <button
                type="button"
                aria-label="返回上层"
                title="返回上层"
                onClick={onUp}
                className={control}
              >
                <GameIcon value="←" className="text-base" />
              </button>
            </>
          ) : null}
        </nav>
        <div className="bg-paper/95 border-ink/15 pointer-events-auto ml-auto flex min-w-0 items-center rounded-sm border p-0.5 shadow-sm backdrop-blur-sm">
          <span
            className="max-w-28 min-w-0 truncate px-2 text-sm font-semibold"
            title={regionName}
          >
            {regionName}
          </span>
          <span className="bg-ink/15 h-5 w-px shrink-0" aria-hidden="true" />
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setMoreOpen(false);
              onSearchOpen();
            }}
            className={control}
          >
            查找
            {categories.length ? (
              <span
                aria-label={`已筛选${categories.length}种类型`}
                className="bg-crimson size-1.5 rounded-full"
              />
            ) : null}
          </button>
          <span className="bg-ink/15 h-5 w-px shrink-0" aria-hidden="true" />
          <div
            ref={more}
            className="relative shrink-0"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setMoreOpen(false);
                moreButton.current?.focus();
              }
            }}
          >
            <button
              ref={moreButton}
              type="button"
              aria-label="更多地图设置"
              aria-expanded={moreOpen}
              aria-controls="atlas-mobile-options"
              onClick={() => {
                onDismiss();
                setMoreOpen((value) => !value);
              }}
              className={control}
            >
              <GameIcon value="⋯" className="text-xl" />
            </button>
            {moreOpen ? (
              <div
                id="atlas-mobile-options"
                role="group"
                aria-label="地图显示方式"
                className="bg-paper border-ink/20 absolute top-[calc(100%+0.5rem)] right-0 w-40 rounded-sm border p-1 shadow-lg"
              >
                <p className="text-ink-secondary px-2 py-2 text-xs">显示方式</p>
                {(['atlas', 'text'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={mapMode === mode}
                    onClick={() => {
                      onMapMode(mode);
                      setMoreOpen(false);
                      moreButton.current?.focus();
                    }}
                    className={`${control} w-full justify-between ${mapMode === mode ? 'bg-ink/8 font-semibold' : ''}`}
                  >
                    <span>{mode === 'atlas' ? '山河画卷' : '文字地图'}</span>
                    <span aria-hidden="true">
                      {mapMode === mode ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <InkDetailDrawer
        isOpen={open}
        title="查找地点"
        onClose={onDismiss}
        closeLabel="完成"
        className="max-h-[70dvh]"
        size="sm"
      >
        <label className="block">
          <span className="sr-only">搜索地点</span>
          <input
            type="search"
            value={query}
            placeholder="输入地点名称"
            autoComplete="off"
            onChange={(event) => {
              if (resultsList.current) resultsList.current.scrollTop = 0;
              onQuery(event.target.value);
            }}
            className="border-ink/25 focus:border-ink/60 min-h-11 w-full rounded-sm border bg-white/50 px-3 text-base outline-none"
          />
        </label>
        {canFilter ? (
          <div
            role="group"
            aria-label="地点类型，可多选"
            className="mt-3 flex flex-wrap gap-1"
          >
            <button
              type="button"
              aria-pressed={!categories.length}
              onClick={() => {
                onSearchAll(false);
                onCategories([]);
              }}
              className={`${control} ${!categories.length ? 'bg-ink/10 font-semibold' : ''}`}
            >
              全部
            </button>
            {ATLAS_CATEGORY_IDS.map((category) => {
              const style = ATLAS_CATEGORY_STYLE[category];
              const active = categories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onSearchAll(false);
                    onCategories(
                      active
                        ? categories.filter((item) => item !== category)
                        : [...categories, category],
                    );
                  }}
                  className={`${control} ${active ? 'bg-ink/10 font-semibold' : ''}`}
                >
                  <GameIcon value={style.icon} className="text-2xl" />
                  {style.name}
                  {active ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        ) : null}
        <label className="text-ink-secondary flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={searchAll}
            onChange={(event) => onSearchAll(event.target.checked)}
            className="accent-ink size-4"
          />
          搜索所有地点（忽略类型筛选）
        </label>
        <p className="text-ink-secondary border-ink/10 border-t py-2 text-xs">
          {query.trim()
            ? '查找结果'
            : searchAll || !hasRegion
              ? '全部地点'
              : regionName}{' '}
          · <span className="font-mono">{results.length}</span>
        </p>
        <ul
          ref={resultsList}
          className="max-h-[30dvh] overflow-y-auto overscroll-contain"
        >
          {results.map((location) => {
            const style = ATLAS_CATEGORY_STYLE[getAtlasCategory(location)];
            return (
              <li key={location.id}>
                <button
                  type="button"
                  onClick={() => onSelect(location.id)}
                  className={`${control} w-full justify-start py-2 text-left`}
                >
                  <GameIcon value={style.icon} className="text-3xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{location.name}</span>
                    <span className="text-ink-secondary block text-xs">
                      {getAtlasRegion(location)?.name} · {style.name}
                    </span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!results.length ? (
          <p role="status" className="text-ink-secondary py-4 text-sm">
            没有找到符合条件的地点，试试其他名称或类型。
          </p>
        ) : null}
      </InkDetailDrawer>
    </>
  );
}
