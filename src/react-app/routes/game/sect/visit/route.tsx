import { SectMap } from '@app/components/feature/sect/SectMap';
import { useSectTasksQuery } from '@app/components/feature/sect/sectResources';
import { InkButton } from '@app/components/ui';
import { useSpecialSceneBackAction } from '@app/layouts/special-scene';
import { usePlayerSession } from '@app/lib/resources/player';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { getSectLandmarkBySectId } from '@shared/lib/game/mapSystem';
import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

export default function SectVisitPage() {
  const navigate = useNavigate();
  const { sectId = '' } = useParams();
  const session = usePlayerSession();
  const tasks = useSectTasksQuery();
  const activeSectId = session.data?.activeCultivator?.sectId ?? null;
  const landmark = getSectLandmarkBySectId(sectId);
  const worldMapHref = landmark
    ? `/game/map?intent=sect&nodeId=${encodeURIComponent(landmark.id)}`
    : '/game/map?intent=sect';
  const backToWorld = useCallback(
    () => navigate(worldMapHref, { replace: true }),
    [navigate, worldMapHref],
  );
  useSpecialSceneBackAction({
    label: '返回大世界',
    onBack: backToWorld,
  });
  const definition = productionSectRuntime.registry.get(sectId)?.definition;
  const bounty = tasks.data?.items.find(
    (task) =>
      task.definitionId === 'weekly_bounty_battle' &&
      task.state === 'active' &&
      task.battleTarget?.sectId === sectId,
  );

  if (activeSectId === sectId) {
    return <Navigate to="/game/sect" replace />;
  }

  if (!definition || !landmark) {
    return (
      <div className="app-safe-area-page bg-paper flex h-full min-h-[100svh] items-center justify-center [--app-safe-area-inline-space:1.5rem]">
        <div className="border-ink/15 bg-background max-w-md border p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">山门不在此界</h1>
          <p className="text-ink-secondary mt-3 text-sm leading-7">
            舆图上没有找到这处宗门，或山门暂时隐入云外。
          </p>
          <InkButton variant="primary" className="mt-5" onClick={backToWorld}>
            返回大世界
          </InkButton>
        </div>
      </div>
    );
  }

  const presentation = getSectPresentation(definition.id);
  return (
    <div className="bg-paper h-full min-h-[100svh] overflow-y-auto pt-[calc(env(safe-area-inset-top)+5.5rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pt-24 md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
      <title>
        {formatDocumentTitle(`${presentation.scenes.map.title} · 访宗`)}
      </title>
      <section className="mx-auto max-w-6xl">
        <div className="border-ink/15 bg-background/92 border p-3 shadow-sm backdrop-blur-sm md:p-5">
          <p className="text-ink-secondary mb-3 text-sm leading-7">
            外宗访客可远观诸院，只在山门与护山阵法外驻足，不得进入门内设施。
          </p>
          <SectMap
            mode="visitor"
            image={presentation.map.image!}
            alt={presentation.map.alt}
            aspectRatio={presentation.map.aspectRatio}
            hotspots={presentation.map.hotspots}
            rooms={presentation.rooms}
            scenes={presentation.scenes}
            visitorEntry={
              bounty
                ? {
                    hotspotId: 'gate',
                    label: '前往山门查探悬赏目标',
                    route: `/game/sect/${encodeURIComponent(sectId)}/gate`,
                  }
                : undefined
            }
            onNavigate={(route) => navigate(route)}
          />
        </div>
      </section>
    </div>
  );
}
