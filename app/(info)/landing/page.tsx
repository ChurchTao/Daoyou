import Image from 'next/image';
import Link from 'next/link';
import { SpiritParticles } from './SpiritParticles';

// --- Icons (Inline SVG) ---

function IconRoots({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22v-9" />
      <path d="M12 13a5 5 0 0 0-5-5" />
      <path d="M12 13a5 5 0 0 1 5-5" />
      <path d="M12 22a5 5 0 0 0-5-5" />
      <path d="M12 22a5 5 0 0 1 5-5" />
      <circle cx="12" cy="5" r="3" />
    </svg>
  );
}

function IconAI({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
      <path d="M10 12h4" />
      <path d="M12 12v3" />
    </svg>
  );
}

function IconCombat({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M19 21l2-2" />
      <path d="m22 22-5-5" />
      <path d="m2 2 5 5" />
    </svg>
  );
}

function IconWorld({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// --- Mockup Component ---

function ScreenshotMockup({ type, title }: { type: string; title: string }) {
  return (
    <div className="w-full h-full flex flex-col bg-[#FDFBF7] rounded overflow-hidden select-none">
      {/* Fake Toolbar */}
      <div className="h-6 bg-[#EBE4D5] border-b border-[#D8CFC0] flex items-center px-2 gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#C1121F] opacity-40"></div>
        <div className="w-2 h-2 rounded-full bg-[#8B4513] opacity-40"></div>
        <div className="w-2 h-2 rounded-full bg-[#4A7C59] opacity-40"></div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 p-3 flex flex-col gap-2 relative overflow-hidden">
        {/* Decorative Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <span className="text-6xl font-heading text-ink">道</span>
        </div>

        {/* Dynamic Mockup Content based on type */}
        {type === 'create' && (
          <>
             <div className="flex gap-2">
                <div className="w-12 h-12 bg-ink/10 rounded border border-ink/20"></div>
                <div className="flex-1 space-y-1">
                   <div className="h-3 bg-ink/10 rounded w-1/3"></div>
                   <div className="h-2 bg-ink/5 rounded w-1/2"></div>
                </div>
             </div>
             <div className="space-y-1 mt-1">
                <div className="h-2 bg-ink/5 rounded w-full"></div>
                <div className="h-2 bg-ink/5 rounded w-5/6"></div>
                <div className="h-2 bg-ink/5 rounded w-4/6"></div>
             </div>
             <div className="mt-auto flex justify-end">
                <div className="h-6 w-16 bg-crimson/80 rounded"></div>
             </div>
          </>
        )}

        {type === 'battle' && (
          <>
             <div className="flex justify-between items-center mb-1">
                <div className="h-2 w-16 bg-crimson/20 rounded"></div>
                <div className="h-2 w-16 bg-teal/20 rounded"></div>
             </div>
             <div className="space-y-1.5 text-[8px] leading-relaxed text-ink/40 font-mono">
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-crimson"></span>
                  <div className="h-1.5 bg-ink/10 rounded w-3/4"></div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-teal"></span>
                  <div className="h-1.5 bg-ink/10 rounded w-1/2"></div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-ink/30"></span>
                  <div className="h-1.5 bg-ink/10 rounded w-2/3"></div>
                </div>
             </div>
             <div className="mt-auto grid grid-cols-3 gap-1">
                <div className="h-5 bg-ink/5 border border-ink/10 rounded"></div>
                <div className="h-5 bg-ink/5 border border-ink/10 rounded"></div>
                <div className="h-5 bg-ink/5 border border-ink/10 rounded"></div>
             </div>
          </>
        )}

        {type === 'world' && (
          <div className="grid grid-cols-3 gap-2 h-full">
            <div className="col-span-1 bg-ink/5 rounded border border-ink/10 p-1 flex flex-col gap-1">
               <div className="h-2 w-8 bg-ink/10 rounded"></div>
               <div className="h-1.5 w-full bg-ink/5 rounded"></div>
               <div className="h-1.5 w-full bg-ink/5 rounded"></div>
            </div>
            <div className="col-span-2 space-y-2">
               <div className="h-16 bg-ink/5 rounded border border-ink/10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-ink/20 rounded-full"></div>
               </div>
               <div className="h-2 w-1/2 bg-ink/10 rounded mx-auto"></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Fake Caption */}
      <div className="bg-[#F0EBE0] py-1 px-2 text-[10px] text-ink/50 text-center font-serif border-t border-[#D8CFC0]">
        {title}
      </div>
    </div>
  );
}


// 特性数据
const features = [
  {
    icon: <IconRoots className="w-10 h-10 text-ink-secondary" />,
    title: '灵根命数',
    description:
      '独特的角色生成系统，五行灵根、先天命数，铸就你独一无二的修仙根基。',
  },
  {
    icon: <IconAI className="w-10 h-10 text-ink-secondary" />,
    title: 'AI 驱动',
    description:
      '基于 AIGC 技术，智能生成剧情对话、奇遇事件，每次游玩都是全新体验。',
  },
  {
    icon: <IconCombat className="w-10 h-10 text-ink-secondary" />,
    title: '自由战斗',
    description:
      '丰富的功法神通、法宝灵器，策略性回合制战斗，挑战各路天骄修士。',
  },
  {
    icon: <IconWorld className="w-10 h-10 text-ink-secondary" />,
    title: '开放世界',
    description:
      '广袤的修仙世界，秘境副本、天机奇遇，等你探索未知的机缘与危险。',
  },
];

// 游戏截图描述
const screenshots = [
  { type: 'create', title: '觉醒灵根，踏入仙途' },
  { type: 'battle', title: '斗法天骄，争锋修仙界' },
  { type: 'world', title: '探索秘境，寻觅机缘' },
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
            <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto drop-shadow-lg">
               <Image
                 src="/assets/daoyou_logo.png"
                 alt="万界道友 Logo"
                 fill
                 className="object-contain"
                 priority
               />
            </div>
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
            <Link href="/create" className="cta-button no-underline group">
              <span className="relative z-10">开启修行</span>
              <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded" />
            </Link>
            <Link href="/" className="cta-button-secondary no-underline group">
              <span className="group-hover:text-crimson transition-colors">继续修行</span>
            </Link>
          </div>
        </div>

        {/* 滚动提示 */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 scroll-hint">
          <p className="text-ink-muted text-sm mb-2 font-serif">向下滑动探索更多</p>
          <svg className="w-6 h-6 text-ink-secondary mx-auto animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
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

          <div className="space-y-6 text-lg text-ink leading-relaxed font-serif">
            <p>
              《万界道友》是一款以{' '}
              <strong className="text-crimson font-medium">AIGC 技术</strong>{' '}
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
                className={`feature-card bg-paper p-6 ancient-border fade-in-up delay-${(index + 1) * 100} group`}
              >
                <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300 origin-left">
                    {feature.icon}
                </div>
                <h3 className="text-xl font-heading text-ink mb-3 group-hover:text-crimson transition-colors">
                  {feature.title}
                </h3>
                <p className="text-ink-secondary leading-relaxed text-sm md:text-base">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {screenshots.map((screenshot, index) => (
              <div
                key={index}
                className="screenshot-card aspect-[4/3] shadow-lg"
              >
                <ScreenshotMockup type={screenshot.type} title={screenshot.title} />
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
              className="inline-flex items-center gap-2 text-ink hover:text-crimson transition-colors no-underline font-medium"
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
        <div className="max-w-4xl mx-auto text-center text-ink-muted text-sm font-serif">
          <p className="mb-2">
            © {new Date().getFullYear()} 万界道友 · 以道会友，共证长生
          </p>
          <p>
            Built with <span className="text-crimson font-bold">Next.js</span> ·{' '}
            <span className="text-teal font-bold">Tailwind CSS</span> ·{' '}
            <span className="text-gold font-bold">AI</span>
          </p>
        </div>
      </footer>
    </div>
  );
}