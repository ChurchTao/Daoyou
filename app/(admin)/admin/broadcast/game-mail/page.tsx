import { GameMailBroadcastForm } from './GameMailBroadcastForm';

export default function AdminGameMailBroadcastPage() {
  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          IN-GAME MAIL
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">游戏邮件群发</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          向活跃角色同步群发公告或奖励，支持模板、创建时间和境界筛选。
        </p>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <GameMailBroadcastForm />
      </section>
    </div>
  );
}
