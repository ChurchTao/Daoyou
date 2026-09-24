import { CultivatorStatsPanel } from '@app/components/feature/cultivator/CultivatorStatsPanel';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { InkNotice } from '@app/components/ui';
import { CultivatorIdentity } from './CultivatorIdentity';
import { CultivatorVitals } from './CultivatorVitals';

export function CharacterAttributesPanel() {
  const projection = useCultivatorDisplayProjection();
  if (projection.error) return <InkNotice>{projection.error}</InkNotice>;
  if (!projection.data) return <InkNotice>正在读取角色属性……</InkNotice>;
  const { cultivator } = projection.data;
  return (
    <div
      key={cultivator.id}
      className="space-y-6 text-sm leading-6 [&_button]:text-sm [&_button]:leading-6 [&_button]:tracking-normal"
    >
      <CultivatorIdentity cultivator={cultivator} />
      <CultivatorVitals projection={projection.data} />
      <CultivatorStatsPanel projection={projection.data} />
    </div>
  );
}
