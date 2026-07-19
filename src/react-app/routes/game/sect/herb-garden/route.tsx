import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { SectPageLoading, SectScene } from '../components/SectScene';

const herbStages = ['新畦初醒', '灵苗成行', '药香盈陌', '四时不歇', '百草丰登'] as const;

export default function SectHerbGardenPage() {
  const { data, error } = useSectCurrentQuery();
  if (!data) return <SectPageLoading message="药田晨雾正在散去……" />;

  const facility = data.overview?.facilities.find((item) => item.key === 'herb_garden');
  const level = facility?.level ?? 1;

  return (
    <SectScene
      title="宗门药田"
      description="层层药畦顺山势铺开，灵泉沿石渠润过根须；成熟灵草将在周俸中交到弟子手中。"
      error={error}
      mood="garden"
      aside={<div className="space-y-2 text-sm leading-7"><p>药田等级：{level}级</p><p>每周基础灵草：{level}份</p></div>}
    >
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="flex min-h-64 flex-col justify-center border-y border-emerald-950/15 bg-white/25 px-6 py-7">
          <p className="text-emerald-900/60 text-xs tracking-[0.3em]">今日长势</p>
          <strong className="mt-3 text-2xl text-emerald-950">{herbStages[level - 1] ?? herbStages[4]}</strong>
          <p className="text-ink-secondary mt-4 text-sm leading-7">药童已按节气完成灌溉与除虫。这里的产出按周结算，无需额外采收，也不会占用建设捐献额度。</p>
        </section>
        <section className="space-y-3 py-2" aria-label="五级药田畦垄">
          {Array.from({ length: 5 }, (_, index) => {
            const active = index < level;
            return (
              <div key={index} className={`flex items-center gap-4 px-4 py-3 ${active ? 'bg-emerald-900/9 text-emerald-950' : 'bg-ink/4 text-ink-secondary'}`}>
                <span className={`h-3 w-3 rotate-45 ${active ? 'bg-emerald-700' : 'bg-ink/15'}`} aria-hidden="true" />
                <span className="flex-1 text-sm">第 {index + 1} 畦灵植</span>
                <span className="text-xs">{active ? '灵息充盈' : '待扩建'}</span>
              </div>
            );
          })}
        </section>
      </div>
    </SectScene>
  );
}
