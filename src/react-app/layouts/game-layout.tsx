import {
  CultivatorOverviewOverlay,
  GameBottomDock,
  GameTopHud,
  useGameHudModel,
} from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { PlayerProvider, usePlayer } from '@app/lib/player/PlayerProvider';
import {
  resolveGameScene,
  resolveRouteTitle,
  type GameSceneHandle,
} from '@app/lib/router/routeTitle';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router';

type SpecialLayoutKind = 'combat' | 'arena' | 'map';

type SpecialBackOverride = {
  label?: string;
  onBack: () => void;
};

type SpecialBackAction =
  | {
      type: 'path';
      label: string;
      href: string;
    }
  | {
      type: 'history-or-path';
      label: string;
      fallbackHref: string;
    };

interface SpecialSceneDescriptor {
  layoutKind: SpecialLayoutKind;
  sceneLabel: string;
  backAction: SpecialBackAction;
}

interface SpecialSceneContextValue {
  backOverride: SpecialBackOverride | null;
  setBackOverride: (next: SpecialBackOverride | null) => void;
}

const SpecialSceneContext = createContext<SpecialSceneContextValue | null>(null);

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <p className="loading-tip">{message}</p>
    </div>
  );
}

function PlayerShell() {
  const { cultivator, note, hasActiveCultivator, isLoading } = usePlayer();

  if (isLoading && !cultivator && !hasActiveCultivator) {
    return <LoadingScreen message="正在推演命盘……" />;
  }

  if (!hasActiveCultivator) {
    const isDead = Boolean(note);

    return (
      <div className="bg-paper flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold tracking-wide">
            {isDead ? '前世道途已尽' : '尚未凝聚真身'}
          </h1>
          <p className="text-ink-secondary mt-3 text-sm leading-7">
            {note ||
              '当前账号下还没有活跃角色。先完成角色创建，再进入万界修行主流程。'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <InkButton
              variant="primary"
              href={isDead ? '/game/reincarnate' : '/game/create'}
            >
              {isDead ? '前往转世重修' : '前往角色创建'}
            </InkButton>
            <InkButton href="/game">返回主界面</InkButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen">
      <Outlet />
    </div>
  );
}

function resolveSpecialSceneDescriptor(
  pathname: string,
  scene: GameSceneHandle | null,
): SpecialSceneDescriptor | null {
  if (!scene || scene.chrome !== 'immersive') {
    return null;
  }

  if (pathname === '/game/bet-battle') {
    return {
      layoutKind: 'arena',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回洞府',
        href: '/game',
      },
    };
  }

  if (pathname === '/game/map') {
    return {
      layoutKind: 'map',
      sceneLabel: scene.label,
      backAction: {
        type: 'history-or-path',
        label: '关闭地图',
        fallbackHref: '/game',
      },
    };
  }

  if (pathname === '/game/battle/challenge') {
    return {
      layoutKind: 'combat',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回天骄榜',
        href: '/game/rankings',
      },
    };
  }

  if (/^\/game\/battle\/[^/]+$/.test(pathname)) {
    return {
      layoutKind: 'combat',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回战绩',
        href: '/game/battle/history',
      },
    };
  }

  if (pathname === '/game/bet-battle/challenge') {
    return {
      layoutKind: 'combat',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回赌战台',
        href: '/game/bet-battle',
      },
    };
  }

  if (pathname === '/game/training-room') {
    return {
      layoutKind: 'combat',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '离开练功房',
        href: '/game',
      },
    };
  }

  if (pathname === '/game/battle') {
    return {
      layoutKind: 'combat',
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回洞府',
        href: '/game',
      },
    };
  }

  return null;
}

function useResolvedSpecialScene() {
  const location = useLocation();
  const matches = useMatches();
  const scene = resolveGameScene(matches);
  const routeTitle = resolveRouteTitle(matches, location);
  const descriptor = useMemo(
    () => resolveSpecialSceneDescriptor(location.pathname, scene),
    [location.pathname, scene],
  );

  return {
    descriptor,
    location,
    routeTitle,
    scene,
  };
}

function SpecialSceneProvider({ children }: { children: ReactNode }) {
  const [backOverride, setBackOverride] = useState<SpecialBackOverride | null>(
    null,
  );
  const value = useMemo(
    () => ({
      backOverride,
      setBackOverride,
    }),
    [backOverride],
  );

  return (
    <SpecialSceneContext.Provider value={value}>
      {children}
    </SpecialSceneContext.Provider>
  );
}

function useSpecialSceneContext() {
  const context = useContext(SpecialSceneContext);

  if (!context) {
    throw new Error('useSpecialSceneContext must be used within a special scene layout');
  }

  return context;
}

function useSpecialSceneBackActionState(descriptor: SpecialSceneDescriptor | null) {
  const navigate = useNavigate();
  const { backOverride } = useSpecialSceneContext();

  const label = backOverride?.label ?? descriptor?.backAction.label ?? '返回';
  const onBack = () => {
    if (backOverride) {
      backOverride.onBack();
      return;
    }

    if (!descriptor) return;

    if (descriptor.backAction.type === 'history-or-path') {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        navigate(-1);
        return;
      }

      navigate(descriptor.backAction.fallbackHref);
      return;
    }

    navigate(descriptor.backAction.href);
  };

  return {
    label,
    onBack,
  };
}

export function useSpecialSceneBackAction(backOverride: SpecialBackOverride | null) {
  const { setBackOverride } = useSpecialSceneContext();
  const label = backOverride?.label;
  const onBack = backOverride?.onBack;

  useEffect(() => {
    setBackOverride(onBack ? { label, onBack } : null);

    return () => {
      setBackOverride(null);
    };
  }, [label, onBack, setBackOverride]);
}

function CombatSceneChrome() {
  const { descriptor, routeTitle } = useResolvedSpecialScene();
  const { label, onBack } = useSpecialSceneBackActionState(descriptor);

  if (!descriptor) {
    return null;
  }

  const detail = routeTitle === descriptor.sceneLabel ? null : routeTitle;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] md:px-5">
      <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.9)] pointer-events-auto inline-flex max-w-md items-start gap-3 border border-dashed px-3 py-2 shadow-[0_10px_30px_rgba(44,24,16,0.08)] backdrop-blur-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-battle-muted hover:text-crimson shrink-0 text-sm transition"
        >
          [{label}]
        </button>
        <div className="min-w-0">
          <div className="text-battle-muted text-[0.66rem] tracking-[0.18em]">
            战局 · {descriptor.sceneLabel}
          </div>
          {detail ? (
            <div className="text-ink mt-1 text-sm leading-6">{detail}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ArenaSceneChrome() {
  const { descriptor } = useResolvedSpecialScene();
  const { label, onBack } = useSpecialSceneBackActionState(descriptor);

  if (!descriptor) {
    return null;
  }

  return (
    <header className="border-battle-rule-strong border-b border-dashed bg-[rgba(248,243,230,0.92)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] pb-2 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="text-battle-muted hover:text-crimson shrink-0 text-sm transition"
        >
          [{label}]
        </button>
        <div className="min-w-0 text-right">
          <div className="text-battle-muted text-[0.66rem] tracking-[0.18em]">
            竞技大厅
          </div>
          <div className="text-ink text-sm leading-6">{descriptor.sceneLabel}</div>
        </div>
      </div>
    </header>
  );
}

function MapSceneChrome() {
  const { descriptor, location } = useResolvedSpecialScene();
  const { label, onBack } = useSpecialSceneBackActionState(descriptor);

  if (!descriptor) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const intentLabel =
    searchParams.get('intent') === 'market' ? '坊市选址' : '历练选址';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] md:px-5">
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={onBack}
          className="border-battle-rule-strong bg-[rgba(248,243,230,0.94)] text-battle-muted hover:text-crimson border border-dashed px-3 py-2 text-sm transition shadow-[0_10px_30px_rgba(44,24,16,0.08)] backdrop-blur-sm"
        >
          [{label}]
        </button>
      </div>
      <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.94)] pointer-events-auto border border-dashed px-4 py-2 text-right shadow-[0_10px_30px_rgba(44,24,16,0.08)] backdrop-blur-sm">
        <div className="text-ink font-semibold">{descriptor.sceneLabel}</div>
        <div className="text-battle-muted text-xs tracking-[0.12em]">
          人界·全图 · {intentLabel}
        </div>
      </div>
    </div>
  );
}

export function GameViewportLayout() {
  const location = useLocation();
  const matches = useMatches();
  const hud = useGameHudModel();
  const scene = resolveGameScene(matches);
  const routeKey = `${location.pathname}${location.search}`;
  const [cultivatorOpenAt, setCultivatorOpenAt] = useState<string | null>(null);
  const [dockExpandedAt, setDockExpandedAt] = useState<string | null>(null);
  const isCultivatorOpen = cultivatorOpenAt === routeKey;
  const isDockExpanded = dockExpandedAt === routeKey;

  const openCultivatorOverview = () => setCultivatorOpenAt(routeKey);
  const closeCultivatorOverview = () => setCultivatorOpenAt(null);
  const toggleDockExpanded = () => {
    setDockExpandedAt((prev) => (prev === routeKey ? null : routeKey));
  };

  return (
    <div className="bg-paper h-screen overflow-hidden">
      <div className="flex h-full flex-col">
        <GameTopHud
          snapshot={hud}
          onOpenCultivator={openCultivatorOverview}
        />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
        <GameBottomDock
          sceneId={scene?.id ?? null}
          unreadMailCount={hud?.unreadMailCount ?? 0}
          isExpanded={isDockExpanded}
          onToggleExpanded={toggleDockExpanded}
          onOpenCultivator={openCultivatorOverview}
          dockMode={scene?.dock ?? 'core'}
        />
      </div>
      <CultivatorOverviewOverlay
        isOpen={isCultivatorOpen}
        onClose={closeCultivatorOverview}
      />
    </div>
  );
}

function GameCombatLayoutBody() {
  return (
    <div className="bg-paper h-screen overflow-hidden">
      <div className="relative h-full overflow-hidden">
        <CombatSceneChrome />
        <main className="h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function GameCombatLayout() {
  return (
    <SpecialSceneProvider>
      <GameCombatLayoutBody />
    </SpecialSceneProvider>
  );
}

function GameArenaLayoutBody() {
  return (
    <div className="bg-paper h-screen overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden">
        <ArenaSceneChrome />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function GameArenaLayout() {
  return (
    <SpecialSceneProvider>
      <GameArenaLayoutBody />
    </SpecialSceneProvider>
  );
}

function GameMapLayoutBody() {
  return (
    <div className="bg-paper h-screen overflow-hidden">
      <div className="relative h-full overflow-hidden">
        <MapSceneChrome />
        <main className="h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function GameMapLayout() {
  return (
    <SpecialSceneProvider>
      <GameMapLayoutBody />
    </SpecialSceneProvider>
  );
}

export default function GameLayout() {
  return (
    <div className="bg-paper min-h-screen">
      <Outlet />
    </div>
  );
}

export function PlayerProviderLayout() {
  return (
    <PlayerProvider>
      <PlayerShell />
    </PlayerProvider>
  );
}
