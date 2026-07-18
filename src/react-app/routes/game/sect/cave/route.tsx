import { InkCard, InkNotice } from '@app/components/ui';
import { hasSectRank } from '@shared/engine/sect';
import { SectPageLoading, SectScene, useSectCurrentData } from '../components/SectScene';

export default function SectCavePage() {
  const { data, error } = useSectCurrentData();
  if (!data) return <SectPageLoading message="洞府石门映入云间……" />;
  const unlocked = hasSectRank(data.sect?.discipleRank ?? 'registered', 'inner');
  return <SectScene title="私人洞府" description="石门隔去峰间喧声，竹影从纸窗落入蒲团；这是内门弟子留在宗门中的一处清修居所。" error={error} mood="cave">{unlocked ? <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.78),transparent_25%),linear-gradient(90deg,rgba(63,67,59,.12),transparent_18%,transparent_82%,rgba(63,67,59,.12))] px-8 py-10 text-center"><InkCard highlighted className="max-w-lg"><p className="text-ink-secondary text-xs tracking-[0.3em]">云竹洞府 · 石门已启</p><p className="text-ink-secondary mt-4 text-sm leading-7">香炉、蒲团与一方石案已经备好。此处只记录你的内门洞府资格，暂不提供额外数值收益。</p></InkCard></div> : <InkNotice>私人洞府须晋升内门弟子后开放。</InkNotice>}</SectScene>;
}
