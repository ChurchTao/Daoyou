import { AlchemyScene } from '@app/components/feature/craft/AlchemyScene';
import { SectPageLoading, useSectCurrentData } from '../components/SectScene';

export default function SectAlchemyPage() {
  const { data } = useSectCurrentData();
  if (!data) return <SectPageLoading message="丹房灵焰正在温炉……" />;

  const level = data.overview?.facilities.find((item) => item.key === 'workshop')?.level ?? 1;
  const rankDiscount = data.sect?.discipleRank === 'true' ? 10 : 0;

  return <AlchemyScene sectContext={{ facilityLevel: level, discountPercent: Math.min(20, level * 2 + rankDiscount) }} />;
}
