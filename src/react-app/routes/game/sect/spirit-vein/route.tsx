import { SectPageLoading, SectScene, useSectCurrentData } from '../components/SectScene';

export default function SectSpiritVeinPage() {
  const { data, error } = useSectCurrentData();
  if (!data) return <SectPageLoading message="矿道深处灵辉渐明……" />;

  const facility = data.overview?.facilities.find((item) => item.key === 'spirit_vein');
  const level = facility?.level ?? 1;
  const bonus = level * 5;

  return (
    <SectScene
      title="灵脉矿场"
      description="矿壁间青光沿岩隙缓缓游走，执事循脉定井；每周俸禄中的灵石加成皆从此处汇出。"
      error={error}
      mood="vein"
      aside={<div className="space-y-2 text-sm leading-7"><p>灵脉等级：{level}级</p><p>俸禄灵石加成：+{bonus}%</p></div>}
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative min-h-64 overflow-hidden bg-slate-900/85 px-6 py-8 text-stone-100 shadow-inner">
          <div aria-hidden="true" className="absolute inset-0 opacity-60 [background:linear-gradient(126deg,transparent_17%,rgba(103,232,249,.35)_18%_19%,transparent_20%_43%,rgba(45,212,191,.24)_44%_46%,transparent_47%_69%,rgba(165,243,252,.28)_70%_71%,transparent_72%)]" />
          <div className="relative max-w-md">
            <p className="text-cyan-100/70 text-xs tracking-[0.3em]">主脉井道 · 脉息稳定</p>
            <p className="mt-6 text-3xl font-semibold">第 {level} 重灵脉</p>
            <p className="mt-4 text-sm leading-7 text-stone-200/80">晶脉亮度均匀，采掘阵盘按周收束灵气。无需弟子手动领取，灵石收益会在周俸结算时一并核算。</p>
          </div>
        </section>
        <section className="self-center border-l border-cyan-950/15 px-5 py-4">
          <p className="text-ink-secondary text-xs tracking-[0.25em]">本级脉效</p>
          <strong className="mt-3 block text-3xl text-cyan-900">+{bonus}%</strong>
          <p className="text-ink-secondary mt-3 text-sm leading-7">只提高每周俸禄中的灵石部分，不改变任务、商店或捐献产生的灵石。</p>
          <div className="mt-6 flex gap-1" aria-label={`灵脉 ${level} 级`}>
            {Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1.5 flex-1 ${index < level ? 'bg-cyan-700/70' : 'bg-ink/10'}`} />)}
          </div>
        </section>
      </div>
    </SectScene>
  );
}
