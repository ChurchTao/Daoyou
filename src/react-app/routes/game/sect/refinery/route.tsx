import { RefineScene } from '@app/components/feature/craft/RefineScene';
import { SectPageLoading, useSectCurrentData } from '../components/SectScene';

export default function SectRefineryPage() {
  const { data } = useSectCurrentData();
  if (!data) return <SectPageLoading message="器坊地火正在升温……" />;

  const level = data.overview?.facilities.find((item) => item.key === 'workshop')?.level ?? 1;
  const rankDiscount = data.sect?.discipleRank === 'true' ? 10 : 0;

  return <RefineScene sectContext={{ facilityLevel: level, discountPercent: Math.min(20, level * 2 + rankDiscount) }} />;
}
