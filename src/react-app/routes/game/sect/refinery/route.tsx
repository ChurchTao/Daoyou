import { RefineScene } from '@app/components/feature/craft/RefineScene';
import {
  useSectCurrentQuery,
  useSectPresentation,
} from '@app/components/feature/sect/SectQueryProvider';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectBenefitMetric } from '@app/lib/sect/sectPresentation';
import {
  SectPageLoading,
  SectPermissionBoundary,
} from '../components/SectScene';

export default function SectRefineryPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.refinery.use"
      sceneKey="refinery"
    >
      <SectRefineryBody />
    </SectPermissionBoundary>
  );
}

function SectRefineryBody() {
  const { data } = useSectCurrentQuery();
  const presentation = useSectPresentation();
  if (!data) return <SectPageLoading sceneKey="refinery" />;

  const effect = (data.benefits ?? data.overview?.benefits)?.facilityEffects
    .refinery;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const discountPercent = getSectBenefitMetric(effect, 'discount') * 100;

  const scene = presentation.scenes.refinery;
  return (
    <>
      <title>{formatDocumentTitle(scene.title)}</title>
      <RefineScene
        sectContext={{
          facilityLevel: level,
          discountPercent,
          facilityLabel:
            presentation.facilityLabels.refinery ??
            presentation.facilityLabels.workshop,
          scene,
        }}
      />
    </>
  );
}
