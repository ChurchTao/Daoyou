import { RoomView, type RoomActorView } from '@app/components/feature/room';
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useBlocker, useSearchParams } from 'react-router';
import type { AlchemyMode } from '@shared/types/consumable';
import { AlchemyCraftSessionProvider } from './AlchemyCraftSessionProvider';
import { ALCHEMY_FACILITIES } from './alchemyFacilities';
import { useAlchemyCraftSession } from './alchemyCraftContext';
import type {
  AlchemyFacilityAction,
  AlchemyFacilityId,
} from './alchemyTypes';
import {
  AlchemyGuideConversation,
  FormulaArchiveConversation,
  FurnaceConversation,
  HerbCabinetConversation,
} from './facilities/AlchemyFacilityConversations';
import { AlchemyGuideView } from './facilities/AlchemyGuideView';
import { FormulaArchiveView } from './facilities/FormulaArchiveView';
import { FurnaceWorkspace } from './facilities/FurnaceWorkspace';
import { HerbCabinetView } from './facilities/HerbCabinetView';

const FACILITY_ACTIONS = {
  furnace: new Set<AlchemyFacilityAction>([
    'improvised',
    'formula',
    'current',
  ]),
  cabinet: new Set<AlchemyFacilityAction>(['materials']),
  formulas: new Set<AlchemyFacilityAction>(['formula-library']),
  guide: new Set<AlchemyFacilityAction>(['guide-basics', 'guide-reference']),
} satisfies Record<AlchemyFacilityId, Set<AlchemyFacilityAction>>;

const isFacilityId = (value: string | null): value is AlchemyFacilityId =>
  value !== null && value in FACILITY_ACTIONS;

export function AlchemyRoomScene() {
  return (
    <AlchemyCraftSessionProvider>
      <AlchemyRoomContent />
    </AlchemyCraftSessionProvider>
  );
}

function AlchemyRoomContent() {
  const session = useAlchemyCraftSession();
  const setCraftMode = session.setMode;
  const [searchParams, setSearchParams] = useSearchParams();
  const blocker = useBlocker(session.phase === 'firing');
  const rawFacility = searchParams.get('facility');
  const rawAction = searchParams.get('action');
  const selectedId = isFacilityId(rawFacility) ? rawFacility : undefined;
  const action =
    selectedId &&
    rawAction &&
    FACILITY_ACTIONS[selectedId].has(rawAction as AlchemyFacilityAction)
      ? (rawAction as AlchemyFacilityAction)
      : undefined;

  useEffect(() => {
    if ((!rawFacility || selectedId) && (!rawAction || action)) return;
    const next = new URLSearchParams(searchParams);
    if (!selectedId) next.delete('facility');
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [action, rawAction, rawFacility, searchParams, selectedId, setSearchParams]);

  useLayoutEffect(() => {
    if (selectedId !== 'furnace') return;
    if (action === 'improvised') setCraftMode('improvised');
    else if (action === 'formula') setCraftMode('formula');
  }, [action, selectedId, setCraftMode]);

  const blockerState = blocker.state;
  const resetBlockedNavigation =
    blocker.state === 'blocked' ? blocker.reset : undefined;
  useEffect(() => {
    if (blockerState === 'blocked') resetBlockedNavigation?.();
  }, [blockerState, resetBlockedNavigation]);

  const setLocation = useCallback(
    (
      facility: AlchemyFacilityId | undefined,
      nextAction?: AlchemyFacilityAction,
      replace = false,
    ) => {
      if (session.phase === 'firing') return;
      const next = new URLSearchParams(searchParams);
      if (facility) next.set('facility', facility);
      else next.delete('facility');
      if (nextAction) next.set('action', nextAction);
      else next.delete('action');
      setSearchParams(next, { replace });
    },
    [searchParams, session.phase, setSearchParams],
  );

  if (session.loading && !session.cultivator)
    return <GameSceneLoading message="丹房禁制正在辨认来者……" />;

  const openAction = (nextAction: AlchemyFacilityAction) => {
    if (nextAction === 'formula' || nextAction === 'improvised') {
      if (session.phase === 'result') session.startNextBatch();
      session.setMode(nextAction);
      setLocation('furnace', nextAction);
      return;
    }
    setLocation(selectedId, nextAction);
  };
  const openFurnace = () =>
    setLocation(
      'furnace',
      session.mode === 'formula' ? 'formula' : 'improvised',
    );
  const actors: RoomActorView[] = [
    {
      ...ALCHEMY_FACILITIES.furnace,
      status: {
        label: furnaceStatus(session),
        tone:
          session.phase === 'result'
            ? 'attention'
            : session.materials.ids.length || session.formula || session.intent
              ? 'active'
              : 'neutral',
      },
    },
    {
      ...ALCHEMY_FACILITIES.cabinet,
      status: { label: '库存可查', tone: 'neutral' },
    },
    {
      ...ALCHEMY_FACILITIES.formulas,
      status: { label: '玉简可阅', tone: 'neutral' },
    },
    {
      ...ALCHEMY_FACILITIES.guide,
      status: { label: '碑文可阅', tone: 'neutral' },
    },
  ];

  const workspace = action ? (
    selectedId === 'furnace' ? (
      <FurnaceWorkspace
        onBack={() => setLocation('furnace', undefined, true)}
        onReturn={() => setLocation(undefined, undefined, true)}
        onModeChange={(nextMode: AlchemyMode) => {
          session.setMode(nextMode);
          setLocation('furnace', nextMode);
        }}
      />
    ) : selectedId === 'cabinet' ? (
      <HerbCabinetView
        onBack={() => setLocation('cabinet', undefined, true)}
        onOpenFurnace={openFurnace}
      />
    ) : selectedId === 'formulas' ? (
      <FormulaArchiveView
        onBack={() => setLocation('formulas', undefined, true)}
        onOpenFurnace={openFurnace}
      />
    ) : selectedId === 'guide' ? (
      <AlchemyGuideView
        focus={action === 'guide-basics' ? 'basics' : 'reference'}
        onBack={() => setLocation('guide', undefined, true)}
        onOpenFurnace={openFurnace}
      />
    ) : null
  ) : null;

  return (
    <GameSceneFrame
      title="【炼丹房】"
      description="丹炉、药柜、丹方玉简与炉理碑各有用途。先与设施交互，再选择要办理的事情。"
    >
      {workspace ?? (
        <RoomView
          eyebrow="丹火沉静 · 四处设施各司其职"
          description="中央丹炉火光微动，药柜、丹方玉简与炉理碑分列四周。走近一处设施，看看它能为你做什么。"
          actors={actors}
          selectedId={selectedId}
          onSelect={(id) => setLocation(id as AlchemyFacilityId)}
          prompt="选择一处设施进行交互"
          detail={
            selectedId === 'furnace' ? (
              <FurnaceConversation
                onExit={() => setLocation(undefined, undefined, true)}
                onOpen={openAction}
              />
            ) : selectedId === 'cabinet' ? (
              <HerbCabinetConversation
                onExit={() => setLocation(undefined, undefined, true)}
                onOpen={openAction}
              />
            ) : selectedId === 'formulas' ? (
              <FormulaArchiveConversation
                onExit={() => setLocation(undefined, undefined, true)}
                onOpen={openAction}
              />
            ) : selectedId === 'guide' ? (
              <AlchemyGuideConversation
                onExit={() => setLocation(undefined, undefined, true)}
                onOpen={openAction}
              />
            ) : undefined
          }
        />
      )}
    </GameSceneFrame>
  );
}

function furnaceStatus(
  session: ReturnType<typeof useAlchemyCraftSession>,
): string {
  if (session.phase === 'firing') return '正在炼制';
  if (session.phase === 'result') return '结果待查看';
  if (session.phase === 'observing') return '预览待确认';
  if (session.mode === 'formula' && session.readyForFormulaAnalysis)
    return '可以查看推演';
  if (session.mode === 'improvised' && session.readyForImprovisedFire)
    return '可以尝试炼制';
  if (session.materials.ids.length || session.formula || session.intent.trim())
    return '已有一炉正在准备';
  return '可以开始炼制';
}
