import {
  buildNodeActions,
  buildSectLandmarkActions,
  resolveMapIntent,
} from '@app/components/feature/map/mapActions';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { updateGameSettings, useGameSettings } from '@app/lib/game-setting';
import { usePlayerSession } from '@app/lib/resources/player';
import {
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
  hasAtlasMap,
} from '@shared/lib/game/mapAtlas';
import {
  matchesAtlasCategories,
  parseAtlasCategories,
  type AtlasCategory,
} from '@shared/lib/game/mapAtlasCategories';
import { getWorldMapLocation } from '@shared/lib/game/mapSystem';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AtlasNodeKinds } from './AtlasNodeKinds';
import { AtlasNodePanel } from './AtlasNodePanel';
import type { AtlasController, AtlasView } from './AtlasPhaserRuntime';
import { AtlasTextMap } from './AtlasTextMap';
import { AtlasToolbar } from './AtlasToolbar';

const locations = getAtlasLocations();

export default function AtlasPage() {
  const { mapMode } = useGameSettings();
  const isAtlas = mapMode === 'atlas';
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const toolsPopover = useRef<HTMLDivElement>(null);
  const controller = useRef<AtlasController | null>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const player = usePlayerSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchAll, setSearchAll] = useState(false);
  const [overlapIds, setOverlapIds] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(() =>
    params.get('nodeId'),
  );
  const [focusRequest, setFocusRequest] = useState(0);
  const [panelPosition, setPanelPosition] = useState({
    right: true,
    bottom: true,
  });
  const [occlusions, setOcclusions] = useState<AtlasView['occlusions']>([]);
  const toolbarBottom = Math.max(
    72,
    (occlusions[0]?.y ?? 0) + (occlusions[0]?.height ?? 0) + 8,
  );
  const nodeId = params.get('nodeId');
  const selected = nodeId ? getWorldMapLocation(nodeId) : undefined;
  const selectedRegion = selected ? getAtlasRegion(selected) : undefined;
  const requestedRegion = ATLAS_REGIONS.find(
    (region) => region.id === params.get('region'),
  );
  const region = selectedRegion ?? requestedRegion;
  const availableRegion = region && hasAtlasMap(region.id) ? region.id : null;
  const unavailable = region && !availableRegion;
  const invalid =
    (nodeId && !selected) ||
    (params.has('region') && !requestedRegion && !selectedRegion);
  const intent = resolveMapIntent(params.get('intent'));
  const requestedCategories = params.has('types')
    ? parseAtlasCategories(params.get('types'))
    : parseAtlasCategories(intent === 'world' ? null : intent);
  // Explicit node links take precedence over a conflicting filter, as they do over region.
  const revealingFilteredNode =
    !!selected && !matchesAtlasCategories(selected, requestedCategories);
  const categories = revealingFilteredNode ? [] : requestedCategories;
  const categoryKey = categories.join(',');
  const mapParams = new URLSearchParams(params);
  if (revealingFilteredNode) mapParams.set('types', 'all');
  const view: AtlasView = {
    region: availableRegion ?? 'world',
    selectedId: selected?.id ?? null,
    blocked: !!unavailable || !!error || overlapIds.length > 0,
    categories,
    focusId,
    focusRequest,
    occlusions,
  };

  const changeRegion = (id?: string) => {
    if (
      id &&
      !ATLAS_REGIONS.some((item) => item.id === id && hasAtlasMap(item.id))
    )
      return;
    const next = new URLSearchParams(mapParams);
    next.delete('nodeId');
    if (id) next.set('region', id);
    else next.delete('region');
    setParams(next);
    setSearchOpen(false);
    setOverlapIds([]);
    setFilterOpen(false);
    setFocusId(null);
  };
  const selectNode = (id: string, locate = false) => {
    const location = getWorldMapLocation(id);
    if (!location) return;
    const targetRegion = getAtlasRegion(location);
    if (!targetRegion || !hasAtlasMap(targetRegion.id)) return;
    const next = new URLSearchParams(mapParams);
    if (!matchesAtlasCategories(location, categories)) next.set('types', 'all');
    next.set('nodeId', id);
    next.set('region', targetRegion.id);
    setParams(next);
    setSearchOpen(false);
    setOverlapIds([]);
    setFilterOpen(false);
    setFocusId(locate ? id : null);
    if (locate) setFocusRequest((value) => value + 1);
  };
  const closeNode = () => {
    const next = new URLSearchParams(mapParams);
    next.delete('nodeId');
    setFocusId(null);
    setFilterOpen(false);
    if (region) next.set('region', region.id);
    setParams(next, { replace: true });
  };
  const launch = (path: string) =>
    navigate(path, {
      state: { mapReturnTo: `/game/map-v2?${mapParams}` },
    });
  const updateCategories = (nextCategories: AtlasCategory[]) => {
    const next = new URLSearchParams(mapParams);
    next.set('types', nextCategories.join(',') || 'all');
    if (selected && !matchesAtlasCategories(selected, nextCategories)) {
      next.delete('nodeId');
      if (region) next.set('region', region.id);
      setFocusId(null);
    }
    setParams(next, { replace: true });
  };
  const onClear = useEffectEvent(closeNode);
  const onSelectionPosition = useEffectEvent(
    (right: boolean, bottom: boolean) => {
      setPanelPosition((previous) =>
        previous.right === right && previous.bottom === bottom
          ? previous
          : { right, bottom },
      );
    },
  );
  const onRegion = useEffectEvent(changeRegion);
  const onNode = useEffectEvent(selectNode);
  const getView = useEffectEvent(() => view);

  useEffect(() => {
    if (!isAtlas) return;
    let disposed = false;
    let ready = false;
    let instance: AtlasController | undefined;
    const timer = window.setTimeout(() => {
      if (!disposed && !ready) setError('画卷打开超时，请重试。');
    }, 15000);
    void Promise.all([
      import('./AtlasPhaserRuntime'),
      document.fonts.load('16px LXGWWenKai').catch(() => []),
    ])
      .then(([runtime]) => {
        if (disposed || !root.current) return;
        setLoading(true);
        setError(null);
        instance = runtime.attachAtlasPhaser({
          root: root.current,
          view: getView(),
          onRegion: (id) => onRegion(id),
          onNode: (id) => onNode(id),
          onClear: () => onClear(),
          onOverlap: setOverlapIds,
          onSelectionPosition: (right, bottom) =>
            onSelectionPosition(right, bottom),
          onLoading: () => {
            if (!disposed) setLoading(true);
          },
          onReady: () => {
            if (!disposed) {
              ready = true;
              window.clearTimeout(timer);
              setLoading(false);
            }
          },
          onError: (message) => {
            if (!disposed) setError(message);
          },
        });
        controller.current = instance;
      })
      .catch(() => {
        if (!disposed) setError('画卷暂时无法打开，请重试。');
      });
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.current = null;
      instance?.destroy();
    };
  }, [attempt, isAtlas]);

  useEffect(() => {
    controller.current?.setView(getView());
  }, [
    view.region,
    view.selectedId,
    view.blocked,
    categoryKey,
    focusId,
    focusRequest,
    occlusions,
  ]);

  useEffect(() => {
    const measure = () => {
      if (!root.current) return;
      const bounds = root.current.getBoundingClientRect();
      const next: AtlasView['occlusions'] = [];
      for (const element of [
        toolbar.current,
        panel.current,
        toolsPopover.current,
      ]) {
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        next.push({
          x: rect.left - bounds.left - 8,
          y: rect.top - bounds.top - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        });
      }
      setOcclusions((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const observer = new ResizeObserver(measure);
    for (const element of [
      root.current,
      toolbar.current,
      panel.current,
      toolsPopover.current,
    ]) {
      if (element) observer.observe(element);
    }
    measure();
    return () => observer.disconnect();
  }, [
    isAtlas,
    selected?.id,
    filterOpen,
    searchOpen,
    panelPosition,
    toolbarBottom,
    availableRegion,
    categoryKey,
    error,
    loading,
  ]);

  const actions =
    selected && !('sect_id' in selected)
      ? buildNodeActions(
          {
            selectedNodeId: selected.id,
            isMainNode: 'region' in selected,
            marketEnabled:
              'market_config' in selected && !!selected.market_config?.enabled,
          },
          launch,
        )
      : selected && 'sect_id' in selected
        ? buildSectLandmarkActions(
            selected.sect_id,
            player.data?.activeCultivator?.sectId ?? null,
            launch,
          )
        : [];
  const regionLocations = locations.filter(
    (location) => getAtlasRegion(location)?.id === region?.id,
  );
  const visibleLocations = regionLocations.filter((location) =>
    matchesAtlasCategories(location, categories),
  );
  const results = locations.filter((location) => {
    if (!searchAll && !matchesAtlasCategories(location, categories))
      return false;
    if (query.trim()) return location.name.includes(query.trim());
    if (searchAll) return true;
    return !region || getAtlasRegion(location)?.id === region.id;
  });

  return (
    <div
      className="relative h-full bg-[#eee7d8]"
      style={
        { '--atlas-toolbar-bottom': `${toolbarBottom}px` } as CSSProperties
      }
    >
      <div ref={root} className="absolute inset-0 overflow-hidden" />

      {isAtlas && loading && !error ? (
        <div className="bg-paper/90 absolute inset-0 z-10">
          <GameLoadingState variant="scene" message="正在展开山河画卷……" />
        </div>
      ) : null}

      <AtlasToolbar
        mapMode={mapMode}
        onMapMode={(mode) => {
          updateGameSettings({ mapMode: mode });
          setSearchOpen(false);
          setFilterOpen(false);
          setOverlapIds([]);
          setError(null);
        }}
        toolbarRef={toolbar}
        popoverRef={toolsPopover}
        regionName={region?.name ?? '人界总览'}
        hasRegion={!!region}
        canFilter={!!availableRegion}
        categories={categories}
        regionLocations={regionLocations}
        results={results}
        query={query}
        searchAll={searchAll}
        searchOpen={searchOpen}
        filterOpen={filterOpen}
        onClose={() => navigate('/game', { replace: true })}
        onUp={() => changeRegion()}
        onQuery={setQuery}
        onSearchAll={setSearchAll}
        onSearchOpen={() => {
          setSearchOpen(true);
          setFilterOpen(false);
        }}
        onFilterOpen={() => {
          setFilterOpen((open) => !open);
          setSearchOpen(false);
        }}
        onDismiss={() => {
          setSearchOpen(false);
          setFilterOpen(false);
        }}
        onCategories={updateCategories}
        onSelect={(id) => selectNode(id, true)}
      />

      {!isAtlas ? (
        <AtlasTextMap
          regionId={availableRegion ?? undefined}
          locations={visibleLocations}
          selected={selected}
          actions={actions}
          onRegion={changeRegion}
          onSelect={selectNode}
          onClose={closeNode}
        />
      ) : null}

      {isAtlas && availableRegion && !visibleLocations.length ? (
        <div
          role="status"
          className="bg-paper/95 absolute top-[var(--atlas-toolbar-bottom)] left-3 z-20 p-3 text-sm"
        >
          当前区域没有符合类型的地点。
          <InkButton onClick={() => updateCategories([])}>显示全部</InkButton>
        </div>
      ) : null}
      {isAtlas && revealingFilteredNode ? (
        <p
          role="status"
          className="bg-paper/95 absolute top-[var(--atlas-toolbar-bottom)] left-3 z-20 p-2 text-sm"
        >
          已显示全部，以定位该地点。
        </p>
      ) : null}

      {isAtlas &&
      selected &&
      !unavailable &&
      !searchOpen &&
      !filterOpen &&
      !error &&
      !loading ? (
        <section
          ref={panel}
          aria-label="选中地点"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeNode();
          }}
          className={`bg-paper/95 absolute right-0 left-0 z-20 mx-3 flex max-h-[40dvh] flex-col overflow-hidden p-3 shadow-md backdrop-blur-sm md:top-[var(--atlas-toolbar-bottom)] md:bottom-auto md:mx-0 md:max-h-[calc(100%-var(--atlas-toolbar-bottom)-1rem)] md:w-80 ${panelPosition.bottom ? 'bottom-[max(env(safe-area-inset-bottom),0.75rem)]' : 'top-[var(--atlas-toolbar-bottom)]'} ${panelPosition.right ? 'md:right-3 md:left-auto' : 'md:right-auto md:left-3'}`}
        >
          <AtlasNodePanel
            location={selected}
            actions={actions}
            onClose={closeNode}
          />
        </section>
      ) : null}

      <InkDetailDrawer
        isOpen={isAtlas && overlapIds.length > 0}
        title="选择地点"
        size="sm"
        onClose={() => setOverlapIds([])}
      >
        <ul className="divide-ink/10 divide-y">
          {overlapIds.map((id) => {
            const location = getWorldMapLocation(id);
            if (!location) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => selectNode(id)}
                  className="w-full py-3 text-left text-sm"
                >
                  <span className="mb-1 block">{location.name}</span>
                  <AtlasNodeKinds location={location} />
                </button>
              </li>
            );
          })}
        </ul>
      </InkDetailDrawer>

      {invalid ? (
        <div
          role="status"
          className="bg-paper/95 absolute top-[var(--atlas-toolbar-bottom)] left-3 z-20 px-3 py-2 text-sm"
        >
          未找到对应地点，已显示可用舆图。
          <InkButton onClick={() => changeRegion()}>返回上层</InkButton>
        </div>
      ) : null}

      {isAtlas && error ? (
        <div
          className="bg-paper/95 absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 text-center"
          role="alert"
        >
          <p>{error}</p>
          <div className="flex gap-4">
            <InkButton
              onClick={() => {
                setError(null);
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              重新展开
            </InkButton>
            <InkButton
              onClick={() => {
                setError(null);
                updateGameSettings({ mapMode: 'text' });
              }}
            >
              使用文字地图
            </InkButton>
          </div>
        </div>
      ) : null}

      {unavailable && !searchOpen && (!isAtlas || !error) ? (
        <InkDetailDrawer
          isOpen
          title={`${region.name}舆图`}
          onClose={() => changeRegion()}
          size="sm"
          footer={
            <InkButton onClick={() => changeRegion()}>返回上层</InkButton>
          }
        >
          <p className="text-sm leading-7">此区域尚未开放。</p>
        </InkDetailDrawer>
      ) : null}
    </div>
  );
}
