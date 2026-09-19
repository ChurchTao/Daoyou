import { MapNodeDetail } from '@app/components/feature/map/MapNodeDetail';
import { SectLandmarkDetail } from '@app/components/feature/map/SectLandmarkDetail';
import {
  buildNodeActions,
  buildSectLandmarkActions,
  resolveMapIntent,
} from '@app/components/feature/map/mapActions';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { usePlayerSession } from '@app/lib/resources/player';
import {
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
} from '@shared/lib/game/mapAtlas';
import { getWorldMapLocation } from '@shared/lib/game/mapSystem';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { AtlasController, AtlasView } from './AtlasPhaserRuntime';

const locations = getAtlasLocations();

export default function AtlasPage() {
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<AtlasController | null>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const player = usePlayerSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const nodeId = params.get('nodeId');
  const selected = nodeId ? getWorldMapLocation(nodeId) : undefined;
  const selectedRegion = selected ? getAtlasRegion(selected) : undefined;
  const requestedRegion = ATLAS_REGIONS.find(
    (region) => region.id === params.get('region'),
  );
  const region = selectedRegion ?? requestedRegion;
  const unavailable = region && region.id !== 'tiannan';
  const invalid =
    (nodeId && !selected) ||
    (params.has('region') && !requestedRegion && !selectedRegion);
  const intent = resolveMapIntent(params.get('intent'));
  const view: AtlasView = {
    region: region?.id === 'tiannan' ? 'tiannan' : 'world',
    selectedId: selected?.id ?? null,
    blocked: !!selected || !!unavailable || searchOpen || !!error,
    intent,
  };

  const changeRegion = (id?: string) => {
    const next = new URLSearchParams(params);
    next.delete('nodeId');
    if (id) next.set('region', id);
    else next.delete('region');
    setParams(next);
    setSearchOpen(false);
  };
  const selectNode = (id: string) => {
    const location = getWorldMapLocation(id);
    if (!location) return;
    const next = new URLSearchParams(params);
    next.set('nodeId', id);
    const targetRegion = getAtlasRegion(location);
    if (targetRegion) next.set('region', targetRegion.id);
    setParams(next);
    setSearchOpen(false);
  };
  const closeNode = () => {
    const next = new URLSearchParams(params);
    next.delete('nodeId');
    if (region) next.set('region', region.id);
    setParams(next, { replace: true });
  };
  const oldMapHref = () => {
    const next = new URLSearchParams(params);
    next.delete('region');
    if (!selected && region) {
      const first = locations.find(
        (location) => getAtlasRegion(location)?.id === region.id,
      );
      if (first) next.set('nodeId', first.id);
    }
    return `/game/map?${next}`;
  };
  const launch = (path: string) =>
    navigate(path, {
      state: { mapReturnTo: `/game/map-v2?${params}` },
    });
  const legacyAction = {
    key: 'legacy-map',
    label: '旧版地图',
    variant: 'secondary' as const,
    onClick: () => navigate(oldMapHref()),
  };
  const onRegion = useEffectEvent(changeRegion);
  const onNode = useEffectEvent(selectNode);
  const getView = useEffectEvent(() => view);

  useEffect(() => {
    let disposed = false;
    let ready = false;
    let instance: AtlasController | undefined;
    const timer = window.setTimeout(() => {
      if (!disposed && !ready) setError('画卷打开超时，请重试或使用旧版地图。');
    }, 15000);
    void Promise.all([
      import('./AtlasPhaserRuntime'),
      document.fonts.load('16px LXGWWenKai').catch(() => []),
    ])
      .then(([runtime]) => {
        if (disposed || !root.current) return;
        instance = runtime.attachAtlasPhaser({
          root: root.current,
          view: getView(),
          onRegion: (id) => onRegion(id),
          onNode: (id) => onNode(id),
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
        if (!disposed) setError('画卷暂时无法打开，请重试或使用旧版地图。');
      });
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.current = null;
      instance?.destroy();
    };
  }, [attempt]);

  useEffect(() => {
    controller.current?.setView(getView());
  }, [view.region, view.selectedId, view.blocked, view.intent]);

  const actions =
    selected && !('sect_id' in selected)
      ? buildNodeActions(
          intent,
          {
            selectedNodeId: selected.id,
            isMainNode: 'region' in selected,
            marketEnabled:
              'market_config' in selected && !!selected.market_config?.enabled,
          },
          launch,
        )
      : [];
  const results = locations.filter((location) => {
    if (query.trim()) return location.name.includes(query.trim());
    return !region || getAtlasRegion(location)?.id === region.id;
  });

  return (
    <div className="relative h-full bg-[#eee7d8]">
      <div ref={root} className="absolute inset-0 overflow-hidden" />

      {loading && !error ? (
        <div className="bg-paper/90 absolute inset-0 z-10">
          <GameLoadingState variant="scene" message="正在展开山河画卷……" />
        </div>
      ) : null}

      <nav
        aria-label="舆图操作"
        className="pointer-events-none absolute right-[max(env(safe-area-inset-right),0.75rem)] bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-[max(env(safe-area-inset-left),0.75rem)] z-20"
      >
        <div className="bg-paper/85 pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-x-2 px-2 py-1 shadow-sm backdrop-blur-sm">
          {region ? (
            <InkButton onClick={() => changeRegion()}>返回人界</InkButton>
          ) : null}
          <InkButton onClick={() => setSearchOpen(true)}>查找地点</InkButton>
          <InkButton onClick={() => navigate(oldMapHref())} variant="secondary">
            旧版地图
          </InkButton>
        </div>
      </nav>

      {invalid ? (
        <div
          role="status"
          className="bg-paper/95 absolute top-[calc(env(safe-area-inset-top)+5.5rem)] left-3 z-20 px-3 py-2 text-sm"
        >
          未找到对应地点，已显示可用舆图。
          <InkButton onClick={() => changeRegion()}>返回总览</InkButton>
        </div>
      ) : null}

      {error ? (
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
            <InkButton onClick={() => navigate(oldMapHref())}>
              使用旧版地图
            </InkButton>
          </div>
        </div>
      ) : null}

      <InkDetailDrawer
        isOpen={searchOpen}
        title="查找地点"
        onClose={() => setSearchOpen(false)}
        size="sm"
      >
        <label className="block text-sm">
          地点名称
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索所有区域"
            className="border-ink/25 mt-2 w-full border-b bg-transparent px-1 py-3 outline-offset-4"
          />
        </label>
        <nav aria-label="区域选择" className="my-4 flex flex-wrap gap-2">
          {ATLAS_REGIONS.map((item) => (
            <InkButton key={item.id} onClick={() => changeRegion(item.id)}>
              {item.name}
            </InkButton>
          ))}
        </nav>
        <ul className="divide-ink/10 divide-y">
          {results.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                className="hover:text-crimson w-full py-3 text-left text-sm"
                onClick={() => selectNode(location.id)}
              >
                {location.name}
                <span className="text-ink-secondary ml-2 text-xs">
                  {getAtlasRegion(location)?.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!results.length ? (
          <p className="text-ink-secondary py-4 text-sm">没有找到这个地点。</p>
        ) : null}
      </InkDetailDrawer>

      {unavailable && !searchOpen && !error ? (
        <InkDetailDrawer
          isOpen
          title={`${region.name}舆图`}
          onClose={() => changeRegion()}
          size="sm"
          footer={
            <InkButton onClick={() => navigate(oldMapHref())}>
              前往旧版地图
            </InkButton>
          }
        >
          <p className="text-sm leading-7">
            此地的新舆图尚在绘制，现有地点与玩法可在旧版地图中继续使用。
          </p>
        </InkDetailDrawer>
      ) : selected && !searchOpen && !error ? (
        'sect_id' in selected ? (
          <SectLandmarkDetail
            landmark={selected}
            onClose={closeNode}
            actions={[
              ...buildSectLandmarkActions(
                selected.sect_id,
                player.data?.activeCultivator?.sectId ?? null,
                launch,
              ),
              legacyAction,
            ]}
          />
        ) : (
          <MapNodeDetail
            node={selected}
            onClose={closeNode}
            actions={[...actions, legacyAction]}
          />
        )
      ) : null}
    </div>
  );
}
