import { useAlchemyCraftSession } from '../alchemyCraftContext';
export function FurnaceFiringStage() {
  const session = useAlchemyCraftSession();
  return (
    <div className="border-crimson/20 overflow-hidden border bg-[radial-gradient(circle_at_50%_65%,rgba(145,36,36,0.18),transparent_52%)] px-5 py-14 text-center">
      <div className="relative mx-auto size-52">
        <span className="border-crimson/30 absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border border-dashed" />
        <span className="border-ink/15 absolute inset-5 animate-[spin_8s_linear_infinite_reverse] rounded-full border" />
        <span className="border-crimson/35 text-crimson absolute inset-12 grid place-items-center rounded-full border bg-[rgba(248,243,230,0.72)] text-5xl shadow-[0_0_45px_rgba(145,36,36,0.18)]">
          鼎
        </span>
      </div>
      <p className="text-crimson mt-8 text-xs tracking-[0.32em]">
        地火回环 · 药蕴聚合
      </p>
      <h3 className="mt-3 text-xl">正在炼制，请稍候</h3>
      <p className="text-ink-secondary mx-auto mt-3 max-w-lg text-sm leading-7">
        {session.status ||
          (session.mode === 'improvised'
            ? '材料正在炉火中发生未知变化，结果要等开鼎后才能知晓。'
            : '丹炉正依照推演火路煅去杂质、收束药力。')}
      </p>
      <div className="text-ink-secondary mx-auto mt-7 flex max-w-md justify-center gap-8 text-xs">
        <span>处理材料</span>
        <span className="text-crimson">汇聚药力</span>
        <span>凝结丹药</span>
        <span>完成炼制</span>
      </div>
    </div>
  );
}
