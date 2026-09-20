import { NpcConversation } from '@app/components/feature/room';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import { createSectTaskBattleHref } from '@app/components/feature/sect/sectTaskActivityLocations';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { useSpecialSceneBackAction } from '@app/layouts/special-scene';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

export default function SectForeignGatePage() {
  const { sectId = '' } = useParams();
  const navigate = useNavigate();
  const tasks = useSectTasksQuery();
  const visitHref = `/game/sect/${encodeURIComponent(sectId)}/visit`;
  const backToVisit = useCallback(
    () => navigate(visitHref, { replace: true }),
    [navigate, visitHref],
  );
  useSpecialSceneBackAction({
    label: '返回访宗舆图',
    onBack: backToVisit,
  });
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
  if (!task?.battleTarget) return <Navigate to={visitHref} replace />;

  const presentation = getSectPresentation(sectId);
  const target = task.battleTarget;
  const claimable = task.state === 'claimable';
  return (
    <div className="bg-paper h-full min-h-[100svh] overflow-y-auto pt-[calc(env(safe-area-inset-top)+5.5rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pt-24 md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
      <title>
        {formatDocumentTitle(`${presentation.scenes.gate.title} · 悬赏目标`)}
      </title>
      <section className="border-ink/15 bg-background/92 mx-auto max-w-4xl border shadow-sm backdrop-blur-sm">
        <NpcConversation
          actor={{
            sigil: target.name.slice(0, 1),
            name: target.name,
            identity: `${definition.name}修士 · 悬赏目标`,
            responsibility: `${target.realm}${target.realmStage}`,
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
            { id: 'leave', label: '返回访宗舆图', tone: 'muted' },
          ]}
          onSelectOption={(optionId) => {
            if (optionId === 'battle')
              navigate(
                createSectTaskBattleHref(
                  task.definitionId,
                  'sect.foreign-gate',
                ),
              );
            else if (optionId === 'affairs') navigate('/game/sect/affairs');
            else if (optionId === 'leave') backToVisit();
          }}
        />
      </section>
    </div>
  );
}
