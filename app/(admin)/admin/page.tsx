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
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          DASHBOARD
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">运营总览</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          后台采用“模块化路由 + 独立布局”的结构。后续新增运营能力时，只需在
          `app/(admin)/admin/` 下添加页面并挂载导航即可。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group border-ink/15 bg-paper/85 hover:border-crimson/50 rounded-xl border p-5 no-underline transition hover:shadow-[0_8px_30px_rgba(44,24,16,0.08)]"
          >
            <p className="text-ink-secondary text-xs tracking-[0.2em]">
              MODULE
            </p>
            <h3 className="text-ink group-hover:text-crimson mt-2 text-xl font-semibold">
              {item.title}
            </h3>
            <p className="text-ink-secondary mt-2 text-sm">
              {item.description}
            </p>
          </Link>
        ))}
      </section>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <h3 className="text-ink text-xl font-semibold">建议下一步迭代</h3>
        <ul className="text-ink-secondary mt-3 space-y-2 text-sm">
          {capabilityRoadmap.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
