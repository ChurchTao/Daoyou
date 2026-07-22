import { AlchemyScene } from '@app/components/feature/craft/AlchemyScene';
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

export default function SectAlchemyPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.alchemy.use"
      sceneKey="alchemy"
    >
      <SectAlchemyBody />
    </SectPermissionBoundary>
  );
}

function SectAlchemyBody() {
  const { data } = useSectCurrentQuery();
  const presentation = useSectPresentation();
  if (!data) return <SectPageLoading sceneKey="alchemy" />;

  const effect = (data.benefits ?? data.overview?.benefits)?.facilityEffects
    .alchemy;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const discountPercent = getSectBenefitMetric(effect, 'discount') * 100;

  const scene = presentation.scenes.alchemy;
  return (
    <>
      <title>{formatDocumentTitle(scene.title)}</title>
      <AlchemyScene
        sectContext={{
          facilityLevel: level,
          discountPercent,
          facilityLabel:
            presentation.facilityLabels.alchemy ??
            presentation.facilityLabels.workshop,
          scene,
        }}
      />
    </>
  );
}
