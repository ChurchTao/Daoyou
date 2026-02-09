import Link from 'next/link';
import { adminNavItems } from './_config/nav';

const capabilityRoadmap = [
  '活动配置中心（开关、时间窗、文案）',
  '玩家检索与定向补发',
  '运营日志与操作审计',
  '批处理任务状态追踪',
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.22em] text-ink-secondary">DASHBOARD</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">运营总览</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-secondary">
          后台采用“模块化路由 + 独立布局”的结构。后续新增运营能力时，只需在
          `app/(admin)/admin/` 下添加页面并挂载导航即可。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-ink/15 bg-paper/85 p-5 no-underline transition hover:border-crimson/50 hover:shadow-[0_8px_30px_rgba(44,24,16,0.08)]"
          >
            <p className="text-xs tracking-[0.2em] text-ink-secondary">MODULE</p>
            <h3 className="mt-2 text-xl font-semibold text-ink group-hover:text-crimson">
              {item.title}
            </h3>
            <p className="mt-2 text-sm text-ink-secondary">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <h3 className="text-xl font-semibold text-ink">建议下一步迭代</h3>
        <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
          {capabilityRoadmap.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
