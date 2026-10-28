import { GuideOverlay } from '@app/components/feature/guide/GuideOverlay';
import { HuntTeamBar } from '@app/components/feature/hunts/HuntTeamBar';
import { WorldChatPreviewBar } from '@app/components/feature/world-chat/WorldChatPreviewBar';
import { WorldChatFeedProvider } from '@app/components/feature/world-chat/useWorldChatFeedModel';
import { GameBottomDock } from '@app/components/game-shell/GameBottomDock';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { GameTopHud } from '@app/components/game-shell/GameTopHud';
import { RealtimeConnectionToasts } from '@app/components/game-shell/RealtimeConnectionToasts';
import { useGameHudModel } from '@app/components/game-shell/useGameHudModel';
import { InkButton } from '@app/components/ui/InkButton';
import { PaperSurface } from '@app/components/ui/PaperSurface';
import { TRANSFER_PENDING_NOTE, TRANSFERRED_NOTE } from '@daoyou/contracts/transfer';
import { AuthProvider } from '@app/lib/auth/authContext';
import { PlayerProvider } from '@app/lib/player/PlayerProvider';
import { usePlayerSession } from '@app/lib/resources/player';
import { resolveMapReturnHref } from '@app/lib/router/mapNavigation';
import type { UserLoaderData } from '@app/lib/router/routeData';
import {
  resolveGameScene,
  resolveRouteTitle,
  type GameSceneHandle,
} from '@app/lib/router/routeTitle';

import { DungeonSceneProvider } from '@app/routes/game/dungeon/dungeonScene';
import { useResolvedDungeonScene } from '@app/routes/game/dungeon/dungeonSceneContext';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import {
  Outlet,
  useLoaderData,
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router';
import { SpecialSceneProvider } from './special-scene';
import { useSpecialSceneBackOverride } from './useSpecialSceneBack.js';

type SpecialBackAction = {
  type: 'path';
  href: string;
  replace?: boolean;
  label: string;
};

interface SpecialSceneDescriptor {
  sceneLabel: string;
  backAction: SpecialBackAction;
}

function LoadingScreen({ message }: { message: string }) {
  return <GameLoadingState message={message} variant="fullscreen" />;
}

function PlayerShell() {
  const session = usePlayerSession();
  const note = session.data?.note;
  const hasActiveCultivator = Boolean(session.data?.activeCultivator);
  const isLoading = session.status === 'idle' || session.status === 'loading';

  if (isLoading && !hasActiveCultivator) {
    return <LoadingScreen message="正在推演命盘……" />;
  }

  if (!hasActiveCultivator) {
    const isDead = note === '前世道途已尽';
    const isTransferPending = note === TRANSFER_PENDING_NOTE;
    const wasTransferred = note === TRANSFERRED_NOTE;

    return (
      <PaperSurface className="app-safe-area-page flex min-h-dvh items-center justify-center">
        <div className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold tracking-wide">
            {isDead ? '前世道途已尽' : isTransferPending ? '道身转服审核中' : wasTransferred ? '道身已转出' : '尚未凝聚真身'}
          </h1>
          <p className="text-ink-secondary mt-3 text-sm leading-7">
            {note ||
              '当前账号下还没有活跃角色。可以创建新角色，也可以从其他服务器转入已有角色。'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <InkButton
              variant="primary"
              href={isTransferPending ? '/transfer' : isDead ? '/game/reincarnate' : '/game/create'}
            >
              {isTransferPending ? '查看转服进度' : isDead ? '前往转世重修' : '前往角色创建'}
            </InkButton>
            <InkButton href="/game">返回主界面</InkButton>
          </div>
          {!isDead && !isTransferPending && !wasTransferred && <div className="mt-4 text-sm text-ink-secondary">
            已有旧服道身？<InkButton href="/transfer?mode=import" variant="secondary">从其他服务器转入</InkButton>
          </div>}
          {(isTransferPending || wasTransferred) && <div className="mt-4"><InkButton href="/transfer" variant="secondary">查看跨服记录</InkButton></div>}
        </div>
      </PaperSurface>
    );
  }

  return <Outlet />;
}

function resolveSpecialSceneDescriptor(
  pathname: string,
  scene: GameSceneHandle | null,
): SpecialSceneDescriptor | null {
  if (!scene || scene.chrome !== 'immersive') {
    return null;
  }

  if (/^\/game\/sect\/[^/]+\/visit$/.test(pathname)) {
    return {
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回大世界',
        href: '/game/map-v2?intent=sect',
        replace: true,
      },
    };
  }

  if (pathname === '/game/battle/challenge') {
    return {
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
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '返回战绩',
        href: '/game/battle/history',
      },
    };
  }

  if (pathname === '/game/training-room') {
    return {
      sceneLabel: scene.label,
      backAction: {
        type: 'path',
        label: '离开练功房',
        href: '/game',
      },
    };
  }

  if (pathname === '/game/wild')
    return {
      sceneLabel: scene.label,
      backAction: { type: 'path', label: '返回地图', href: '/game/map-v2' },
    };

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

function useSpecialSceneBackActionState(
  descriptor: SpecialSceneDescriptor | null,
) {
  const navigate = useNavigate();
  const location = useLocation();
  const backOverride = useSpecialSceneBackOverride();

  const label = backOverride?.label ?? descriptor?.backAction.label ?? '返回';
  const onBack = () => {
    if (backOverride) {
      backOverride.onBack();
      return;
    }

    if (!descriptor) return;

    navigate(resolveMapReturnHref(descriptor.backAction.href, location.state), {
      replace: descriptor.backAction.replace,
    });
  };

  return {
    label,
    onBack,
  };
}

function SectVisitSceneChrome() {
  const { descriptor, location, routeTitle } = useResolvedSpecialScene();
  const { label, onBack } = useSpecialSceneBackActionState(descriptor);

  // World atlas navigation is owned by AtlasToolbar; this chrome is only for sect visits.
  if (!descriptor || !/^\/game\/sect\/[^/]+\/visit$/.test(location.pathname)) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between pt-[calc(var(--app-safe-top)+0.65rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.25rem)] md:pl-[max(env(safe-area-inset-left),1.25rem)]">
      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={onBack}
          className="border-battle-rule-strong text-battle-muted hover:text-crimson border border-dashed bg-paper px-3 py-2 text-sm shadow-[0_10px_30px_rgba(44,24,16,0.08)] backdrop-blur-sm transition"
        >
          [{label}]
        </button>
      </div>
      <div className="border-battle-rule-strong pointer-events-auto border border-dashed bg-paper px-4 py-2 text-right shadow-[0_10px_30px_rgba(44,24,16,0.08)] backdrop-blur-sm">
        <div className="text-ink font-semibold">{routeTitle}</div>
        <div className="text-battle-muted text-xs tracking-[0.12em]">
          人界 · 访宗舆图
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
  const [dockExpandedAt, setDockExpandedAt] = useState<string | null>(null);
  const bottomChromeRef = useRef<HTMLDivElement | null>(null);
  const [bottomChromeHeight, setBottomChromeHeight] = useState<number | null>(
    null,
  );
  const isDockExpanded = dockExpandedAt === routeKey;

  const toggleDockExpanded = () => {
    setDockExpandedAt((prev) => (prev === routeKey ? null : routeKey));
  };

  useEffect(() => {
    const node = bottomChromeRef.current;
    if (!node) {
      setBottomChromeHeight(0);
      return;
    }

    const updateBottomChromeHeight = () => {
      setBottomChromeHeight(Math.ceil(node.getBoundingClientRect().height));
    };

    updateBottomChromeHeight();

    const observer = new ResizeObserver(updateBottomChromeHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [routeKey, scene?.dock]);

  const viewportStyle = useMemo(
    () =>
      ({
        '--game-bottom-offset':
          bottomChromeHeight !== null
            ? `${bottomChromeHeight}px`
            : 'calc(var(--app-bottom-reserve) + 7rem)',
      }) as CSSProperties,
    [bottomChromeHeight],
  );

  return (
    <PaperSurface data-game-viewport className="min-h-dvh" style={viewportStyle}>
      <AuthProvider>
      <WorldChatFeedProvider>
        <div className="flex min-h-dvh flex-col">
          <PaperSurface className="sticky top-0 z-30">
            <GameTopHud snapshot={hud} />
            <HuntTeamBar />
          </PaperSurface>
          <main
            className="min-h-0 flex-1"
            style={{
              paddingBottom: 'var(--game-bottom-offset)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
              scrollPaddingBottom: 'var(--game-bottom-offset)',
            }}
          >
            <Outlet />
          </main>
        </div>
        <RealtimeConnectionToasts />
        <GuideOverlay />
        <PaperSurface
          data-game-bottom-chrome
          ref={bottomChromeRef}
          className="game-bottom-chrome"
        >
          <WorldChatPreviewBar />
          <GameBottomDock
            sceneId={scene?.id ?? null}
            unreadMailCount={hud?.unreadMailCount ?? 0}
            hasUnallocatedAttributePoints={
              hud?.hasUnallocatedAttributePoints ?? false
            }
            isExpanded={isDockExpanded}
            onToggleExpanded={toggleDockExpanded}
            dockMode={scene?.dock ?? 'core'}
          />
        </PaperSurface>
      </WorldChatFeedProvider>
      </AuthProvider>
    </PaperSurface>
  );
}

function GameCombatLayoutBody() {
  return (
    <PaperSurface className="h-dvh overflow-hidden">
      <main className="h-full overflow-hidden">
        <Outlet />
      </main>
    </PaperSurface>
  );
}

export function GameCombatLayout() {
  return (
    <SpecialSceneProvider>
      <GameCombatLayoutBody />
    </SpecialSceneProvider>
  );
}

export function GameActivityLayout() {
  return (
    <div className="bg-scene h-[100dvh] touch-none overflow-hidden overscroll-none">
      <main className="h-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function GameNarrativeLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

function GameMapLayoutBody() {
  return (
    <div className="bg-scene h-dvh overflow-hidden">
      <div className="relative h-full overflow-hidden">
        <SectVisitSceneChrome />
        <main className="h-full overflow-hidden">
          <Outlet />
        </main>
        <GuideOverlay />
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

interface GenesisSceneDescriptor {
  sceneLabel: string;
  subtitle: string;
  backAction: {
    label: string;
    href: string;
  };
}

function resolveGenesisSceneDescriptor(
  pathname: string,
): GenesisSceneDescriptor {
  if (pathname === '/game/reincarnate') {
    return {
      sceneLabel: '转世重修',
      subtitle: '身死道不灭，握紧前世余荫再闯仙途。',
      backAction: {
        label: '返回主界',
        href: '/game',
      },
    };
  }

  return {
    sceneLabel: '凝气篇',
    subtitle: '以心念唤道，凝气成形，择定此世的根基与气数。',
    backAction: {
      label: '返回主界',
      href: '/game',
    },
  };
}

function GameGenesisLayoutBody() {
  const location = useLocation();
  const matches = useMatches();
  const routeTitle = resolveRouteTitle(matches, location);
  const descriptor = useMemo(
    () => resolveGenesisSceneDescriptor(location.pathname),
    [location.pathname],
  );

  return (
    <PaperSurface className="h-dvh overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden">
        <header className="border-battle-rule-strong border-b border-dashed bg-paper">
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 pt-[calc(var(--app-safe-top)+0.8rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-3 pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
            <InkButton href={descriptor.backAction.href}>
              {descriptor.backAction.label}
            </InkButton>
            <div className="min-w-0 text-right">
              <div className="text-battle-muted text-[0.66rem] tracking-[0.18em]">
                入道宿主
              </div>
              <div className="text-ink mt-1 text-lg leading-6">
                {routeTitle}
              </div>
              <div className="text-battle-muted mt-1 text-sm leading-6">
                {descriptor.subtitle}
              </div>
            </div>
          </div>
        </header>
        <main className="battle-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl py-4 pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:py-5 md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
            <Outlet />
          </div>
        </main>
      </div>
    </PaperSurface>
  );
}

export function GameGenesisLayout() {
  return <GameGenesisLayoutBody />;
}

const DUNGEON_SCENE_TOP_OFFSET_FALLBACK =
  'calc(var(--app-safe-top) + 3.5rem)';

function DungeonSceneChrome({
  chromeRef,
  isScrolled,
}: {
  chromeRef?: RefObject<HTMLDivElement | null>;
  isScrolled: boolean;
}) {
  const navigate = useNavigate();
  const descriptor = useResolvedDungeonScene();

  return (
    <div
      ref={chromeRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
    >
      <div
        className={
          isScrolled
            ? 'border-ink/10 bg-paper pointer-events-auto border-b border-dashed'
            : 'pointer-events-auto'
        }
      >
        <div className="mx-auto flex min-h-12 w-full max-w-5xl items-center gap-3 pt-[var(--app-safe-top)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
          <button
            type="button"
            onClick={() => navigate(descriptor.backAction.href)}
            className="text-battle-muted hover:text-crimson shrink-0 text-sm transition"
          >
            {descriptor.backAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function GameDungeonLayoutBody() {
  const descriptor = useResolvedDungeonScene();
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const [chromeHeight, setChromeHeight] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const isImmersiveBattleScene = descriptor.density === 'full';

  useEffect(() => {
    const node = chromeRef.current;
    if (!node) {
      setChromeHeight(0);
      return;
    }

    const updateChromeHeight = () => {
      setChromeHeight(Math.ceil(node.getBoundingClientRect().height));
    };

    updateChromeHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateChromeHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isImmersiveBattleScene]);

  const dungeonLayoutStyle = useMemo(
    () =>
      ({
        '--dungeon-scene-top-offset':
          chromeHeight !== null
            ? `${chromeHeight}px`
            : DUNGEON_SCENE_TOP_OFFSET_FALLBACK,
      }) as CSSProperties,
    [chromeHeight],
  );
  const updateScrollState = useCallback(() => {
    const node = mainRef.current;
    setIsScrolled(Boolean(node && node.scrollTop > 8));
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [descriptor, updateScrollState]);

  return (
    <PaperSurface className="h-dvh overflow-hidden" style={dungeonLayoutStyle}>
      <div className="relative h-full overflow-hidden">
        {!isImmersiveBattleScene && (
          <DungeonSceneChrome chromeRef={chromeRef} isScrolled={isScrolled} />
        )}
        <main
          ref={mainRef}
          onScroll={updateScrollState}
          className={
            isImmersiveBattleScene
              ? 'h-full overflow-hidden'
              : 'battle-scroll h-full overflow-y-auto'
          }
        >
          <Outlet />
        </main>
      </div>
    </PaperSurface>
  );
}

export function GameDungeonLayout() {
  return (
    <DungeonSceneProvider>
      <GameDungeonLayoutBody />
    </DungeonSceneProvider>
  );
}

export default function GameLayout() {
  const { userId } = useLoaderData() as UserLoaderData;
  return (
    <PlayerProvider accountId={userId}>
      <Outlet />
    </PlayerProvider>
  );
}

export function PlayerShellLayout() {
  return <PlayerShell />;
}
