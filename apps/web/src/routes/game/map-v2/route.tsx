import { HuntLobbyDrawer } from '@app/components/feature/hunts/HuntLobbyDrawer';
import {
  HuntMapMarkers,
  type HuntMapPoint,
} from '@app/components/feature/hunts/HuntMapMarkers';
import { useHunts } from '@app/components/feature/hunts/useHunts';
import { MapCanvasSurface } from '@app/components/feature/map/MapCanvasSurface';
import {
  buildMapLocationActions,
  resolveMapIntent,
} from '@app/components/feature/map/mapActions';
import { WandererDrawer } from '@app/components/feature/wanderer/WandererDrawer';
import {
  WandererMarker,
  type WandererMapPoint,
} from '@app/components/feature/wanderer/WandererMarker';
import { ImmersiveGameFrame } from '@app/components/game-shell/ImmersiveGameFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { bodyFontFamily } from '@app/lib/fonts';
import { updateGameSettings, useGameSettings } from '@app/lib/game-setting';
import { usePlayerSession } from '@app/lib/resources/player';
import { type WandererState } from '@daoyou/contracts/wanderer';
import {
  getMapAreaContent,
  getWorldMapLocation,
} from '@daoyou/game-content/world/map';
import { type HuntEvent } from '@daoyou/game-domain/hunts';
import { huntMapHref } from '@daoyou/game-rules/hunts';
import {
  ATLAS_REGIONS,
  getAtlasCategory,
  getAtlasLocations,
  getAtlasRegion,
  getAtlasShortName,
  hasAtlasMap,
  matchesAtlasCategories,
  parseAtlasCategories,
  type AtlasCategory,
} from '@daoyou/game-rules/world/atlas';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AtlasArea } from './AtlasArea';
import { AtlasNodeKinds } from './AtlasNodeKinds';
import { AtlasNodePanel } from './AtlasNodePanel';
import type { AtlasController, AtlasView } from './AtlasPhaserRuntime';
import { AtlasTextMap } from './AtlasTextMap';
import { AtlasToolbar, type AtlasSearchResult } from './AtlasToolbar';
import { atlasAreaHref } from './areaNavigation';
import { ATLAS_ARTWORK } from './atlasArtwork';

const locations = getAtlasLocations();
const searchEntries = locations.flatMap<AtlasSearchResult>((location) => {
  const region = getAtlasRegion(location);
  const entry = {
    id: location.id,
    name: location.name,
    context: region?.name,
    category: getAtlasCategory(location),
    regionId: region?.id,
  };
  const places =
    'region' in location ? (getMapAreaContent(location.id)?.places ?? []) : [];
  return [
    entry,
    ...places.map((place): AtlasSearchResult => ({
      id: place.id,
      name: place.name,
      context: location.name,
      category: 'landmark',
      regionId: region?.id,
      areaId: location.id,
    })),
  ];
});
// Region switches reuse the Canvas runtime, so prepare every map label once.
const atlasFontText = [
  ...ATLAS_REGIONS.map((region) => region.name),
  ...locations.map(getAtlasShortName),
  '› · 未开放',
].join('');

export default function AtlasPage() {
  const [params] = useSearchParams();
  if (params.get('entry') === 'gate') {
    return <Navigate to="/game/sect/onboarding?entry=gate" replace />;
  }
  const area = getWorldMapLocation(params.get('area') ?? '');
  const nodeId = params.get('nodeId');
  const node = nodeId ? getWorldMapLocation(nodeId) : undefined;
  if (
    area &&
    'region' in area &&
    (!nodeId ||
      node?.id === area.id ||
      (node && 'parent_id' in node && node.parent_id === area.id))
  ) {
    return <AtlasArea key={area.id} area={area} params={params} node={node} />;
  }
  return (
    <ImmersiveGameFrame>
      <AtlasMap />
    </ImmersiveGameFrame>
  );
}

function AtlasMap() {
  const { mapMode } = useGameSettings();
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const toolsPopover = useRef<HTMLDivElement>(null);
  const controller = useRef<AtlasController | null>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const huntFeed = useHunts<{ events: HuntEvent[]; serverNow: number }>(
    '/api/hunts',
    15000,
  );
  const huntEvents = huntFeed.data?.events ?? [];
  const huntEventId = params.get('hunt');
  const [huntPoints, setHuntPoints] = useState<HuntMapPoint[]>([]);
  const huntKey = huntEvents.map((e) => e.id).join(',');
  const wandererFeed = useHunts<WandererState>('/api/wanderer', 15000);
  const wanderer = wandererFeed.data ?? null;
  const wandererKey = wanderer
    ? `${wanderer.id}:${wanderer.x}:${wanderer.y}:${wanderer.regionId}`
    : '';
  const [wandererPoint, setWandererPoint] = useState<WandererMapPoint | null>(
    null,
  );
  const teachingMap = params.get('guide') === 'map-qingxi';
  const isAtlas = mapMode === 'atlas' && !teachingMap;
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
    hunts: huntEvents,
    wanderer: wanderer
      ? {
          id: wanderer.id,
          regionId: wanderer.regionId,
          x: wanderer.x,
          y: wanderer.y,
        }
      : null,
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
    next.delete('hunt');
    next.delete('wanderer');
    next.delete('nodeId');
    next.delete('area');
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
    next.delete('hunt');
    next.delete('wanderer');
    next.delete('area');
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
    next.delete('hunt');
    next.delete('wanderer');
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
  const openWanderer = () => {
    if (!wanderer) return;
    const next = new URLSearchParams(mapParams);
    next.set('region', wanderer.regionId);
    next.set('wanderer', wanderer.id);
    next.delete('nodeId');
    next.delete('hunt');
    setParams(next);
    setSearchOpen(false);
    setOverlapIds([]);
    setFilterOpen(false);
    setFocusId(null);
  };
  const closeWanderer = () => {
    const next = new URLSearchParams(mapParams);
    next.delete('wanderer');
    setParams(next, { replace: true });
  };
  const updateCategories = (nextCategories: AtlasCategory[]) => {
    const next = new URLSearchParams(mapParams);
    next.set('types', nextCategories.join(',') || 'all');
    if (selected && !matchesAtlasCategories(selected, nextCategories)) {
      next.delete('hunt');
      next.delete('wanderer');
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
      document.fonts
        .load(`16px "${bodyFontFamily}"`, atlasFontText)
        .catch(() => []),
    ])
      .then(([runtime]) => {
        if (disposed || !root.current) return;
        setLoading(true);
        setError(null);
        instance = runtime.attachAtlasPhaser({
          root: root.current,
          view: getView(),
          onHuntPositions: (points) =>
            setHuntPoints((previous) =>
              JSON.stringify(previous) === JSON.stringify(points)
                ? previous
                : points,
            ),
          onWandererPosition: (point) =>
            setWandererPoint((previous) =>
              JSON.stringify(previous) === JSON.stringify(point)
                ? previous
                : point,
            ),
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
    huntKey,
    wandererKey,
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

  const actions = selected
    ? buildMapLocationActions(
        selected,
        player.data?.activeCultivator?.sectId ?? null,
        launch,
      )
    : [];
  if (selected && 'region' in selected) {
    const areaHref = atlasAreaHref(mapParams, {
      area: selected.id,
      region: selectedRegion?.id,
    });
    const prioritizeMarket =
      intent === 'market' && actions.some((action) => action.gate === 'market');
    const enterArea = {
      key: 'enter-area',
      label: '进入区域',
      onClick: () => navigate(areaHref),
    };
    if (prioritizeMarket) {
      actions.push({ ...enterArea, variant: 'secondary' });
    } else {
      for (const action of actions) action.variant = 'secondary';
      actions.unshift({ ...enterArea, variant: 'primary' });
    }
  }
  const regionLocations = locations.filter(
    (location) => getAtlasRegion(location)?.id === region?.id,
  );
  const visibleLocations = regionLocations.filter((location) =>
    matchesAtlasCategories(location, categories),
  );
  const searchTerm = query.trim();
  const results = searchEntries.filter((location) => {
    if (
      !searchAll &&
      categories.length &&
      !categories.includes(location.category)
    )
      return false;
    if (searchTerm) return location.name.includes(searchTerm);
    return searchAll || !region || location.regionId === region.id;
  });

  return (
    <div
      className={`relative h-full bg-[#eee7d8] ${isAtlas ? '' : 'dark:bg-sheet'}`}
      style={
        { '--atlas-toolbar-bottom': `${toolbarBottom}px` } as CSSProperties
      }
    >
      <MapCanvasSurface
        root={root}
        image={isAtlas ? ATLAS_ARTWORK[view.region] : undefined}
      />

      {!teachingMap && !error && (!isAtlas || !loading) ? (
        <HuntMapMarkers
          events={huntEvents}
          points={huntPoints}
          showList={!isAtlas || !availableRegion}
          onSelect={(event) => {
            setFocusId(event.nodeId);
            setFocusRequest((n) => n + 1);
            setSearchOpen(false);
            setFilterOpen(false);
            navigate(huntMapHref(event));
          }}
        />
      ) : null}
      {isAtlas && !teachingMap && !error && !loading ? (
        <WandererMarker point={wandererPoint} onSelect={openWanderer} />
      ) : null}
      {params.get('wanderer') === wanderer?.id &&
      availableRegion === wanderer?.regionId ? (
        <WandererDrawer onClose={closeWanderer} />
      ) : null}
      {huntEventId ? (
        <HuntLobbyDrawer
          key={huntEventId}
          eventId={huntEventId}
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete('hunt');
            setParams(next, { replace: true });
          }}
        />
      ) : null}
      {huntFeed.error ? (
        <p
          role="status"
          className="bg-paper/95 absolute bottom-3 left-3 z-20 p-2 text-xs"
        >
          讨伐消息暂不可用{' '}
          <button onClick={huntFeed.refresh} className="underline">
            重试
          </button>
        </p>
      ) : null}
      {isAtlas && loading && !error ? (
        <p
          role="status"
          className="bg-paper/95 text-ink-secondary pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm px-3 py-2 text-sm"
        >
          正在展开山河画卷……
        </p>
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
        onSelect={(result) => {
          if (result.areaId) {
            navigate(
              atlasAreaHref(mapParams, {
                area: result.areaId,
                site: result.id,
                region: result.regionId,
              }),
            );
          } else {
            selectNode(result.id, true);
          }
        }}
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
          onMerchant={
            wanderer && availableRegion === wanderer.regionId
              ? openWanderer
              : undefined
          }
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
          className="bg-paper/95 absolute inset-x-3 top-1/2 z-20 mx-auto flex w-fit -translate-y-1/2 flex-col items-center gap-4 rounded-sm p-4 text-center shadow-sm"
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
