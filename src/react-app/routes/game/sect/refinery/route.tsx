import { RefineScene } from '@app/components/feature/craft/RefineScene';
import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { getSectBenefitMetric } from '@app/lib/sect/sectPresentation';
import { SectPageLoading, SectPermissionBoundary } from '../components/SectScene';

export default function SectRefineryPage() {
  return <SectPermissionBoundary permission="sect.facility.refinery.use" title="器坊"><SectRefineryBody /></SectPermissionBoundary>;
}

function SectRefineryBody() {
  const { data } = useSectCurrentQuery();
  if (!data) return <SectPageLoading message="器坊地火正在升温……" />;

  const effect = (data.benefits ?? data.overview?.benefits)?.facilityEffects.refinery;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const discountPercent = getSectBenefitMetric(effect, 'discount') * 100;

  return <RefineScene sectContext={{ facilityLevel: level, discountPercent }} />;
}
