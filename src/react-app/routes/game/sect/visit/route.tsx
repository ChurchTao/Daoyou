import { NarrativePerformanceLoading } from '@app/components/feature/narrative/NarrativePerformanceLoading';
import { SectMap } from '@app/components/feature/sect/SectMap';
import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkButton } from '@app/components/ui';
import { useSpecialSceneBackAction } from '@app/layouts/special-scene';
import { usePlayerState } from '@app/lib/player-state/store';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { fetchSectDetail } from '@app/lib/sect/sectClient';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { getSectLandmarkBySectId } from '@shared/lib/game/mapSystem';
import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

export default function SectVisitPage() {
  const navigate = useNavigate();
  const { sectId = '' } = useParams();
  const activeSectId = usePlayerState(
    (state) => state.snapshot.sect?.sectId ?? null,
  );
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
  const detail = useSectResourceQuery(`detail:${sectId}`, (signal) =>
    fetchSectDetail(sectId, signal),
  );

  if (activeSectId === sectId) {
    return <Navigate to="/game/sect" replace />;
  }

  if (detail.error || !landmark) {
    return (
      <div className="bg-paper flex h-full min-h-[100svh] items-center justify-center px-6">
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

  if (!detail.data) {
    return <NarrativePerformanceLoading message="访帖正送往山门……" />;
  }

  const presentation = getSectPresentation(detail.data.definition.id);
  return (
    <div className="bg-paper h-full min-h-[100svh] overflow-y-auto px-3 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-6 md:px-6 md:pt-24">
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
            hotspots={presentation.map.hotspots}
          />
        </div>
      </section>
    </div>
  );
}
