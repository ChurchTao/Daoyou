import {
  NpcConversation,
  NpcConversationPresentationProvider,
} from '@app/components/feature/room';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import { createSectTaskBattleHref } from '@app/components/feature/sect/sectTaskActivityLocations';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { resolveMapReturnHref } from '@app/lib/router/mapNavigation';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { SectTaskViewData } from '@daoyou/contracts/sect';
import { productionSectRuntime } from '@daoyou/game-rules/sect-organization/production';
import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { SectImmersiveFrame } from '../components/SectImmersiveFrame';

export default function SectForeignGatePage() {
  const { sectId = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const tasks = useSectTasksQuery();
  const visitHref = `/game/sect/${encodeURIComponent(sectId)}/visit`;
  const mapReturnTo = resolveMapReturnHref('/game/map-v2?intent=sect', state);
  const backToVisit = useCallback(
    () =>
      navigate(visitHref, {
        replace: true,
        state: { mapReturnTo, sectMapSpotId: 'gate' },
      }),
    [mapReturnTo, navigate, visitHref],
  );
  const definition = productionSectRuntime.registry.get(sectId)?.definition;
  const task = tasks.data?.items.find(
    (candidate) =>
      candidate.definitionId === 'weekly_bounty_battle' &&
      (candidate.state === 'active' || candidate.state === 'claimable') &&
      candidate.battleTarget?.sectId === sectId,
  );

  if (!definition) return <Navigate to="/game/map-v2?intent=sect" replace />;
  if (!tasks.data)
    return <GameImmersiveLoading message="正在核对悬赏令与山门来客……" />;
  if (!task?.battleTarget)
    return <Navigate to={visitHref} state={{ mapReturnTo }} replace />;

  const presentation = getSectPresentation(sectId);
  return (
    <SectImmersiveFrame
      title={`${presentation.scenes.gate.title} · 悬赏目标`}
      sectName={definition.name}
      image={presentation.map.image}
      backAction={{ label: '返回访宗舆图', onBack: backToVisit }}
    >
      <NpcConversationPresentationProvider presentation="immersive">
        <SectForeignGateConversation
          sectName={definition.name}
          task={task}
          onExit={backToVisit}
        />
      </NpcConversationPresentationProvider>
    </SectImmersiveFrame>
  );
}

export function SectForeignGateConversation({
  sectName,
  task,
  onExit,
  exitLabel = '返回访宗舆图',
}: {
  sectName: string;
  task: SectTaskViewData;
  onExit(): void;
  exitLabel?: string;
}) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const target = task.battleTarget;
  if (!target) return null;
  const claimable = task.state === 'claimable';

  return (
    <NpcConversation
      actor={{
        sigil: target.name.slice(0, 1),
        name: target.name,
        identity: `${sectName}修士 · 悬赏目标`,
        responsibility: `${target.realm}${target.realmStage}`,
        portrait: target.portrait,
      }}
      messages={[
        {
          id: 'arrival',
          body: claimable
            ? '山门外的战局已经结束，悬赏回执也已写成。'
            : `山门禁制外，那名修士已经察觉你的来意。${target.description}`,
          tone: claimable ? 'attention' : 'normal',
        },
      ]}
      options={[
        ...(claimable
          ? [
              {
                id: 'affairs',
                label: '返回本宗事务堂复命',
                tone: 'primary' as const,
              },
            ]
          : [
              {
                id: 'battle',
                label: `向${target.name}发起挑战`,
                tone: 'primary' as const,
              },
            ]),
        { id: 'leave', label: exitLabel, tone: 'muted' },
      ]}
      onSelectOption={(optionId) => {
        if (optionId === 'battle')
          navigate(
            createSectTaskBattleHref(task.definitionId, 'sect.foreign-gate'),
            { state },
          );
        else if (optionId === 'affairs') navigate('/game/sect/affairs');
        else if (optionId === 'leave') onExit();
      }}
    />
  );
}
