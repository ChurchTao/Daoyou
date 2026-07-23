import { RetreatView } from '@app/components/feature/retreat/RetreatView';
import {
  useSectCurrentQuery,
  useSectPresentation,
} from '@app/components/feature/sect/SectQueryProvider';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectBenefitMetric } from '@app/lib/sect/sectPresentation';
import { Suspense } from 'react';
import {
  SectPageLoading,
  SectPermissionBoundary,
} from '../components/SectScene';

export default function SectCultivationRoomPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.cultivation.use"
      sceneKey="cultivation"
    >
      <SectCultivationRoomBody />
    </SectPermissionBoundary>
  );
}

function SectCultivationRoomBody() {
  const { data } = useSectCurrentQuery();
  const presentation = useSectPresentation();
  if (!data) return <SectPageLoading sceneKey="cultivation" />;

  const effect = (data.benefits ?? data.overview?.benefits)?.facilityEffects
    .cultivation_room;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const experienceBonusPercent =
    getSectBenefitMetric(effect, 'retreat_bonus') * 100;
  const scene = presentation.scenes.cultivation;

  return (
    <>
      <title>{formatDocumentTitle(scene.title)}</title>
      <Suspense fallback={<SectPageLoading sceneKey="cultivation" />}>
        <RetreatView
          sectContext={{
            facilityLevel: level,
            experienceBonusPercent,
            facilityLabel: presentation.facilityLabels.cultivation_room,
            scene,
          }}
        />
      </Suspense>
    </>
  );
}
