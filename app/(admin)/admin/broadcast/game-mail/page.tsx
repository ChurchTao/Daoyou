import { GameMailBroadcastForm } from './GameMailBroadcastForm';

export default function AdminGameMailBroadcastPage() {
  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">IN-GAME MAIL</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">游戏邮件群发</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          向活跃角色同步群发公告或奖励，支持模板、创建时间和境界筛选。
        </p>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <GameMailBroadcastForm />
      </section>
    </div>
  );
}
