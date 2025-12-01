'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';

const quickActions = [
  { label: '⚔️ 挑战天骄', href: '/rankings' },
  { label: '🧍 道我真形', href: '/cultivator' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 所修神通', href: '/skills' },
  { label: '🔥 炼器 / 顿悟', href: '/ritual' },
  { label: '📜 战报', href: '/battle' },
];

export default function HomePage() {
  const { cultivator, isLoading, note, usingMock } = useCultivatorBundle();

  const hp = cultivator?.battleProfile?.hp ?? '--';
  const maxHp = cultivator?.battleProfile?.maxHp ?? 100;
  const spirit = cultivator?.battleProfile?.attributes.spirit ?? '--';

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen">
      <main className="mx-auto flex max-w-xl flex-col px-4 pt-8 pb-24 main-content">
        {/* 顶部角色状态栏 */}
        <section className="mb-6 rounded-lg border border-ink/15 bg-paper-light p-4 shadow-sm">
          {cultivator ? (
            <>
              <div className="text-lg font-semibold">
                <span className="status-icon">☯</span>道号：{cultivator.name}
              </div>
              <p className="mt-1">
                <span className="status-icon">🌿</span>境界：{cultivator.cultivationLevel} · {cultivator.spiritRoot}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-base">
                <span>
                  <span className="status-icon">❤️</span>气血：{hp}/{maxHp}
                </span>
                <span>
                  <span className="status-icon">⚡</span>灵力：{spirit}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-ink-secondary">
              道友尚未觉醒灵根，先至【创建】一观。
            </div>
          )}
        </section>

        {/* 天机模块 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-ink">【天机】</h2>
          <div className="mt-3 rounded-lg border border-ink/10 bg-paper-light p-4 shadow-sm">
            <p>{'>'} 今日宜：炼器、挑战</p>
            <p>{'>'} 忌：双修（身负孤辰入命）</p>
            <p className="mt-2 text-sm text-ink-secondary">【占位】天机文案由 AIGC 生成，接口待接入。</p>
          </div>
        </section>

        {/* 快捷入口 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-ink">【快捷入口】</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="btn-primary py-3 text-center">
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        {/* 近期战绩 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink">【近期战绩】</h2>
          <div className="mt-3 rounded-lg border border-ink/10 bg-paper-light p-4 shadow-sm">
            <p>✓ 胜 苏红袖（火凤门）</p>
            <p>✗ 败 剑无尘（天剑阁）</p>
            <p className="mt-2 text-sm text-ink-secondary">【占位】真实战绩将与战报系统联动。</p>
          </div>
        </section>

        {/* CTA */}
        {!cultivator && (
          <div className="mb-8 text-center">
            <Link href="/create" className="btn-primary inline-flex items-center justify-center">
              觉醒灵根
            </Link>
          </div>
        )}

        {/* 底部引文 */}
        <div className="mt-auto text-center">
          <div className="divider">
            <span className="divider-line">──────────────────────────────</span>
          </div>
          <p className="my-4 text-lg italic">天地不仁，以万物为刍狗。</p>
          <p className="mb-4 text-lg">道友，今日可要逆天改命？</p>
          <div className="divider">
            <span className="divider-line">──────────────────────────────</span>
          </div>
          {note && <p className="mt-2 text-sm text-crimson/80">{note}</p>}
          {usingMock && (
            <p className="text-xs text-ink-secondary">
              当前展示为硬编码示例，后续接入真实数据信息。
            </p>
          )}
        </div>
      </main>

      {/* 底部固定导航栏（主界面专属） */}
      <nav className="bottom-nav">
        <Link href="/" className="bottom-nav-item active">
          首页
        </Link>
        <Link href="/inventory" className="bottom-nav-item">
          储物
        </Link>
        <Link href="/skills" className="bottom-nav-item">
          神通
        </Link>
        <Link href="/rankings" className="bottom-nav-item">
          天机榜
        </Link>
      </nav>
    </div>
  );
}

