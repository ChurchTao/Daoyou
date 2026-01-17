import { changelogs } from '@/data/changelog';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from './Navbar';
import { ScrollHint } from './ScrollHint';
import { SpiritParticles } from './SpiritParticles';
import './landing.css';

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

// --- Data ---

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

const screenshots = [
  { type: 'create', title: '觉醒灵根，踏入仙途' },
  { type: 'battle', title: '斗法天骄，争锋修仙界' },
  { type: 'world', title: '探索秘境，寻觅机缘' },
];

// --- Main Page Component (Server Component) ---

export default function LandingPage() {
  const latestUpdates = changelogs.slice(0, 3);

  return (
    <div className="bg-paper min-h-screen selection:bg-crimson/20 selection:text-ink">
      <Navbar />

      {/* Hero 区域 */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden pt-16">
        <SpiritParticles />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-8 fade-in-up">
            <div className="relative w-32 h-32 md:w-48 md:h-48 mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-700 ease-in-out">
              <Image
                src="/assets/daoyou_logo.png"
                alt="万界道友 Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <h1 className="text-5xl md:text-8xl font-heading text-ink title-glow mb-6 fade-in-up delay-100 leading-tight">
            万界道友录
          </h1>

          <p className="text-xl md:text-3xl text-ink-secondary mb-3 fade-in-up delay-200 font-light tracking-wide">
            以 AIGC 驱动的
            <span className="text-crimson font-medium mx-1">高自由度</span>
            文字修仙
          </p>

          <div className="flex items-center justify-center gap-4 text-sm md:text-base text-ink-muted mb-10 fade-in-up delay-300 opacity-80">
            <span>开源免费</span>
            <span className="w-1 h-1 rounded-full bg-ink/30" />
            <span>无限剧情</span>
            <span className="w-1 h-1 rounded-full bg-ink/30" />
            <span>独创功法</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center fade-in-up delay-400">
            <Link href="/create" className="cta-button group">
              <span className="relative z-10">觉醒灵根</span>
              <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded" />
            </Link>
            <Link href="/login" className="cta-button-secondary group">
              <span>继续仙途</span>
            </Link>
          </div>
        </div>

        <ScrollHint />

        <div className="hero-decoration" />
      </section>

      {/* 简介区 */}
      <section className="py-20 md:py-28 px-4 ink-wash-bg relative">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-block mb-6">
            <h2 className="text-3xl md:text-5xl font-heading text-ink section-title-decorated">
              大道三千，只取一瓢
            </h2>
          </div>

          <div className="space-y-6 text-lg md:text-xl text-ink leading-relaxed opacity-90">
            <p>
              《万界道友》不仅仅是一款游戏，更是一个
              <br className="md:hidden" />
              <strong className="text-crimson font-medium">
                由 AI 构建的动态修仙世界
              </strong>
              。
            </p>
            <p>
              告别千篇一律的剧本，每一次开局都是全新的命运。
              <br />
              这里的奇遇由算法生成，这里的功法由你来命名。
            </p>
            <p className="text-ink-secondary italic">
              天地不仁，以万物为刍狗；
              <br />
              唯有修仙，方可逆天改命。
            </p>
          </div>
        </div>
      </section>

      {/* 核心特性区 */}
      <section id="features" className="py-20 md:py-28 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading text-ink section-title-decorated">
              核心特色
            </h2>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`feature-card bg-paper p-8 ancient-border group`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-6 transform group-hover:scale-110 transition-transform duration-500 origin-center text-ink group-hover:text-crimson">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-heading text-ink mb-4 group-hover:text-crimson transition-colors">
                  {feature.title}
                </h3>
                <p className="text-ink-secondary leading-loose text-sm md:text-base">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 游戏截图区 */}
      <section
        id="gameplay"
        className="py-20 md:py-28 px-4 ink-wash-bg scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading text-ink section-title-decorated">
              游戏一览
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {screenshots.map((screenshot, index) => (
              <div
                key={index}
                className="screenshot-card aspect-4/3 shadow-lg group cursor-default"
              >
                <ScreenshotMockup
                  type={screenshot.type}
                  title={screenshot.title}
                />
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 text-crimson hover:text-ink transition-colors font-heading text-lg border-b border-crimson/30 hover:border-ink pb-0.5"
            >
              <span>查看更多玩法说明</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* 仙界传书 (公告) */}
      <section id="updates" className="py-20 md:py-28 px-4 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading text-ink section-title-decorated">
              仙界传书
            </h2>
            <p className="mt-4 text-ink-muted text-sm">LATEST UPDATES</p>
          </div>

          <div className="bg-paper border border-ink/10 rounded-lg p-8 shadow-sm relative overflow-hidden">
            {/* 装饰水印 */}
            <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none transform rotate-12">
              <IconRoots className="w-64 h-64 text-ink" />
            </div>

            <div className="relative z-10 space-y-2">
              {latestUpdates.map((log) => (
                <div key={log.version} className="timeline-item group">
                  <div className="timeline-dot group-hover:bg-crimson group-hover:scale-125"></div>
                  <div className="timeline-date">
                    {log.date} · {log.version}
                  </div>
                  <h3 className="text-xl font-bold text-ink mb-2 group-hover:text-crimson transition-colors">
                    {log.title}
                  </h3>
                  <ul className="list-none space-y-1">
                    {log.changes.slice(0, 2).map((change, i) => (
                      <li
                        key={i}
                        className="text-ink-secondary text-sm md:text-base pl-2 border-l-2 border-transparent hover:border-ink/20"
                      >
                        {change}
                      </li>
                    ))}
                    {log.changes.length > 2 && (
                      <li className="text-ink-muted text-xs pt-1">
                        ... 以及更多优化
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center pt-8 border-t border-ink/5">
              <Link
                href="/changelog"
                className="cta-button-secondary text-sm py-2 px-6"
              >
                查看全部更新日志
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="py-20 md:py-28 px-4 ink-wash-bg text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-heading text-ink mb-6">
            即刻踏入仙途
          </h2>
          <p className="text-lg text-ink-secondary mb-10">
            无需下载，点击即玩。
            <br />
            你的修仙传说，从此刻开始书写。
          </p>
          <Link
            href="/create"
            className="cta-button text-xl px-12 py-4 shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            立即开始
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-10 px-4 border-t border-ink/10 bg-paper">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Image
                src="/assets/daoyou_logo.png"
                alt="Logo"
                width={24}
                height={24}
              />
              <span className="font-heading text-lg">万界道友</span>
            </div>
            <p className="text-ink-muted text-xs">
              © {new Date().getFullYear()} daoyou.org. GPL-3.0 Licensed.
            </p>
          </div>

          <div className="flex gap-6 text-sm text-ink-secondary">
            <Link
              href="https://github.com/ChurchTao/wanjiedaoyou"
              className="hover:text-crimson transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/changelog"
              className="hover:text-crimson transition-colors"
            >
              更新日志
            </Link>
            <Link
              href="/about"
              className="hover:text-crimson transition-colors"
            >
              关于我们
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
