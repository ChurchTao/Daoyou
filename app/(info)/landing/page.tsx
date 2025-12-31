import Image from 'next/image';
import Link from 'next/link';
import { SpiritParticles } from './SpiritParticles';

// 特性数据
const features = [
  {
    icon: '🎲',
    title: '灵根命数',
    description:
      '独特的角色生成系统，五行灵根、先天命数，铸就你独一无二的修仙根基。',
  },
  {
    icon: '🤖',
    title: 'AI 驱动',
    description:
      '基于 AIGC 技术，智能生成剧情对话、奇遇事件，每次游玩都是全新体验。',
  },
  {
    icon: '⚔️',
    title: '自由战斗',
    description:
      '丰富的功法神通、法宝灵器，策略性回合制战斗，挑战各路天骄修士。',
  },
  {
    icon: '🌍',
    title: '开放世界',
    description:
      '广袤的修仙世界，秘境副本、天机奇遇，等你探索未知的机缘与危险。',
  },
];

// 游戏截图描述（用于 alt 和标题）
const screenshots = [
  { alt: '角色创建界面', title: '觉醒灵根，踏入仙途' },
  { alt: '战斗界面', title: '斗法天骄，争锋修仙界' },
  { alt: '秘境探索', title: '探索秘境，寻觅机缘' },
];

/**
 * 游戏宣传主页
 * 静态服务端组件，仅粒子效果使用客户端渲染
 */
export default function LandingPage() {
  return (
    <div className="bg-paper min-h-screen">
      {/* Hero 区域 */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* 灵气粒子背景 - 客户端组件 */}
        <SpiritParticles />

        {/* 内容 */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-6 fade-in-up">
            <Image
              src="/assets/daoyou_logo.png"
              alt="万界道友 Logo"
              width={160}
              height={160}
              className="mx-auto drop-shadow-lg"
              priority
            />
          </div>

          {/* 标题 */}
          <h1 className="text-5xl md:text-7xl font-heading text-ink title-glow mb-4 fade-in-up delay-100">
            万界道友录
          </h1>

          {/* 副标题 */}
          <p className="text-xl md:text-2xl text-ink-secondary mb-2 fade-in-up delay-200">
            以 AIGC 驱动的文字修仙
          </p>

          <p className="text-base md:text-lg text-ink-muted mb-8 fade-in-up delay-300">
            开源免费 · 高自由度 · 无限可能
          </p>

          {/* CTA 按钮组 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center fade-in-up delay-400">
            <Link href="/create" className="cta-button no-underline">
              开启修行
            </Link>
            <Link href="/" className="cta-button-secondary no-underline">
              继续修行
            </Link>
          </div>
        </div>

        {/* 滚动提示 */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 scroll-hint">
          <p className="text-ink-muted text-sm mb-2">向下滑动探索更多</p>
          <span className="text-2xl text-ink-secondary">↓</span>
        </div>

        {/* 底部渐变装饰 */}
        <div className="hero-decoration" />
      </section>

      {/* 游戏简介区 */}
      <section className="py-16 md:py-24 px-4 ink-wash-bg">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading text-ink mb-8 section-title-decorated">
            何为万界道友
          </h2>

          <div className="space-y-6 text-lg text-ink leading-relaxed">
            <p>
              《万界道友》是一款以{' '}
              <strong className="text-crimson">AIGC 技术</strong>{' '}
              驱动的高自由度文字修仙游戏。
            </p>
            <p>
              在这里，你将以普通修士之身，借灵根、功法、神通、法宝与奇遇，
              一步步推演自己独一无二的修行之路。
            </p>
            <p className="text-ink-secondary">
              突破境界、探索秘境、挑战天骄、争霸万界——
              <br />
              你的每一个选择，都将书写属于你的修仙传说。
            </p>
          </div>
        </div>
      </section>

      {/* 核心特性区 */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-heading text-ink mb-12 text-center section-title-decorated">
            核心特色
          </h2>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`feature-card bg-paper p-6 ancient-border fade-in-up delay-${(index + 1) * 100}`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-heading text-ink mb-3">
                  {feature.title}
                </h3>
                <p className="text-ink-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 游戏截图区 */}
      <section className="py-16 md:py-24 px-4 ink-wash-bg">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-heading text-ink mb-12 text-center section-title-decorated">
            游戏一览
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {screenshots.map((screenshot, index) => (
              <div
                key={index}
                className="screenshot-card aspect-video bg-ink/5 flex items-center justify-center"
              >
                <div className="text-center p-4">
                  <p className="text-ink-secondary text-sm">{screenshot.alt}</p>
                  <p className="text-ink font-heading text-lg mt-2">
                    {screenshot.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-ink-muted mt-8 text-sm">
            * 游戏以文字为主要表现形式，辅以精心设计的 UI 交互
          </p>
        </div>
      </section>

      {/* 入门指引区 */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading text-ink mb-6 section-title-decorated">
            踏入仙途
          </h2>

          <p className="text-lg text-ink-secondary mb-8">
            无需下载、无需付费，浏览器即可游玩。
            <br />
            你的修仙之旅，只差一次点击。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link href="/create" className="cta-button no-underline">
              觉醒灵根，开始修行
            </Link>
          </div>

          {/* 开源信息 */}
          <div className="pt-8 border-t border-ink/10">
            <p className="text-ink-muted mb-4">
              《万界道友》是一个开源项目，欢迎参与贡献
            </p>
            <a
              href="https://github.com/ChurchTao/wanjiedaoyou"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-ink hover:text-crimson transition-colors no-underline"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-4 border-t border-ink/10">
        <div className="max-w-4xl mx-auto text-center text-ink-muted text-sm">
          <p className="mb-2">
            © {new Date().getFullYear()} 万界道友 · 以道会友，共证长生
          </p>
          <p>
            Built with <span className="text-crimson">Next.js</span> ·{' '}
            <span className="text-teal">Tailwind CSS</span> ·{' '}
            <span className="text-gold">AI</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
