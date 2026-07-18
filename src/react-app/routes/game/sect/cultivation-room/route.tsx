import { RetreatView } from '@app/components/feature/retreat/RetreatView';
import { Suspense } from 'react';
import { SectPageLoading, useSectCurrentData } from '../components/SectScene';

export default function SectCultivationRoomPage() {
  const { data } = useSectCurrentData();
  if (!data) return <SectPageLoading message="聚灵阵正在汇拢灵气……" />;

  const level = data.overview?.facilities.find((item) => item.key === 'cultivation_room')?.level ?? 1;

  return (
    <Suspense fallback={<SectPageLoading message="修炼室石门正在开启……" />}>
      <RetreatView sectContext={{ facilityLevel: level, experienceBonusPercent: level * 2 }} />
    </Suspense>
  );
}
