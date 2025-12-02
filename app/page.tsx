'use client';

import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { InkButton, InkLink, InkDivider } from '@/components/InkComponents';

const quickActions = [
  { label: '⚔️ 挑战天骄', href: '/rankings' },
  { label: '👤 凝视道身', href: '/cultivator' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 顿悟', href: '/skills' },
  { label: '🔥 炼器', href: '/ritual' },
  { label: '🌀 奇遇', href: '/ritual' },
  { label: '📜 战报', href: '/battle' },
];

// 每日引文轮换
const dailyQuotes = [
  { quote: '天地不仁，以万物为刍狗。', question: '道友，今日可要逆天改命？' },
  { quote: '道可道，非常道。', question: '名可名，非常名。' },
  { quote: '上善若水，水善利万物而不争。', question: '处众人之所恶，故几于道。' },
  { quote: '大道无形，生育天地。', question: '大道无情，运行日月。' },
];

// 根据日期选择引文
const getDailyQuote = () => {
  const day = new Date().getDate();
  return dailyQuotes[day % dailyQuotes.length];
};

export default function HomePage() {
  const { cultivator, isLoading, note, usingMock } = useCultivatorBundle();
  const dailyQuote = getDailyQuote();

  // 计算气血（基于体魄属性）
  const maxHp = cultivator ? 80 + cultivator.attributes.vitality : 100;
  const currentHp = maxHp; // 暂时使用最大值，后续可从战斗状态获取
  const spirit = cultivator?.attributes.spirit ?? 0;
  const maxSpirit = spirit; // 暂时使用当前值，后续可从战斗状态获取

  if (isLoading) {
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
        <section className="mb-6 pb-4 border-b border-ink/10">
          {cultivator ? (
            <>
              <div className="text-lg font-semibold">
                <span className="status-icon">☯</span>道号：{cultivator.name}
              </div>
              <p className="mt-1">
                <span className="status-icon">🌿</span>境界：{cultivator.realm}{cultivator.realm_stage} · {cultivator.origin || '散修'}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-base">
                <span>
                  <span className="status-icon">❤️</span>气血：{currentHp}/{maxHp}
                </span>
                <span>
                  <span className="status-icon">⚡</span>灵力：{spirit}/{maxSpirit}
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
          <div className="mt-3 pb-4 border-b border-ink/10">
            {cultivator && cultivator.pre_heaven_fates?.length > 0 ? (
              <>
                <p>{'>'} 今日宜：炼器、挑战</p>
                {cultivator.pre_heaven_fates.some(f => f.name.includes('孤辰') || f.name.includes('孤')) && (
                  <p>{'>'} 忌：双修（身负孤辰入命）</p>
                )}
              </>
            ) : (
              <>
                <p>{'>'} 今日宜：炼器、挑战</p>
                <p>{'>'} 忌：无</p>
              </>
            )}
            <p className="mt-2 text-sm text-ink-secondary">【占位】天机文案由 AIGC 生成，接口待接入。</p>
          </div>
        </section>

        {/* 快捷入口 - 紧凑排列 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-ink">【快捷入口】</h2>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {quickActions.map((action) => (
              <InkButton
                key={action.label}
                href={action.href}
                variant="default"
                className="text-sm"
              >
                {action.label}
              </InkButton>
            ))}
          </div>
        </section>

        {/* 近期战绩 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink">【近期战绩】</h2>
          <div className="mt-3 pb-4 border-b border-ink/10">
            <p className="text-ink-secondary">【占位】真实战绩将与战报系统联动。</p>
            <p className="mt-2 text-sm text-ink-secondary">✓ 胜 苏红袖（火凤门）</p>
            <p className="text-sm text-ink-secondary">✗ 败 剑无尘（天剑阁）</p>
          </div>
        </section>

        {/* CTA */}
        {!cultivator && (
          <div className="mb-8 text-center">
            <InkButton href="/create" variant="primary" className="text-lg">
              觉醒灵根
            </InkButton>
          </div>
        )}

        {/* 底部引文 */}
        <div className="mt-auto text-center">
          <InkDivider />
          <p className="my-4 text-lg italic">{dailyQuote.quote}</p>
          <p className="mb-4 text-lg">{dailyQuote.question}</p>
          <InkDivider />
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
        <InkLink href="/" active={true}>
          首页
        </InkLink>
        <InkLink href="/inventory">
          储物
        </InkLink>
        <InkLink href="/skills">
          神通
        </InkLink>
        <InkLink href="/rankings">
          天机榜
        </InkLink>
      </nav>
    </div>
  );
}

