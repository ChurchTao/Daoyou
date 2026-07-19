import { AlchemyScene } from '@app/components/feature/craft/AlchemyScene';
import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { getSectBenefitMetric } from '@app/lib/sect/sectPresentation';
import { SectPageLoading, SectPermissionBoundary } from '../components/SectScene';

export default function SectAlchemyPage() {
  return <SectPermissionBoundary permission="sect.facility.alchemy.use" title="丹房"><SectAlchemyBody /></SectPermissionBoundary>;
}

function SectAlchemyBody() {
  const { data } = useSectCurrentQuery();
  if (!data) return <SectPageLoading message="丹房灵焰正在温炉……" />;

  const effect = (data.benefits ?? data.overview?.benefits)?.facilityEffects.alchemy;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const discountPercent = getSectBenefitMetric(effect, 'discount') * 100;

  return <AlchemyScene sectContext={{ facilityLevel: level, discountPercent }} />;
}
