import { changelogs } from '@/data/changelog';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from './Navbar';
import { ScrollHint } from './ScrollHint';
import { SpiritParticles } from './SpiritParticles';
import { ScreenshotGallery } from './components/ScreenshotGallery';
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

// --- Data ---

const features = [
  {
    icon: <IconRoots className="text-ink-secondary h-10 w-10" />,
    title: '灵根命数',
    description:
      '独特的角色生成系统，五行灵根、先天命数，铸就你独一无二的修仙根基。',
  },
  {
    icon: <IconAI className="text-ink-secondary h-10 w-10" />,
    title: 'AI 驱动',
    description:
      '基于 AIGC 技术，智能生成剧情对话、奇遇事件，每次游玩都是全新体验。',
  },
  {
    icon: <IconCombat className="text-ink-secondary h-10 w-10" />,
    title: '自由战斗',
    description:
      '丰富的功法神通、法宝灵器，策略性回合制战斗，挑战各路天骄修士。',
  },
  {
    icon: <IconWorld className="text-ink-secondary h-10 w-10" />,
    title: '开放世界',
    description:
      '广袤的修仙世界，秘境副本、天机奇遇，等你探索未知的机缘与危险。',
  },
];

// --- Main Page Component (Server Component) ---

export default function LandingPage() {
  const latestUpdates = changelogs.slice(0, 3);

  return (
    <div className="bg-paper selection:bg-crimson/20 selection:text-ink min-h-screen">
      <Navbar />

      {/* Hero 区域 */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-16">
        <SpiritParticles />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="fade-in-up mb-8">
            <div className="relative mx-auto h-32 w-32 drop-shadow-2xl transition-transform duration-700 ease-in-out hover:scale-105 md:h-48 md:w-48">
              <Image
                src="/assets/daoyou_logo.png"
                alt="万界道友 Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <h1 className="font-heading text-ink title-glow fade-in-up mb-6 text-5xl leading-tight delay-100 md:text-8xl">
            万界道友录
          </h1>

          <p className="text-ink-secondary fade-in-up mb-3 text-xl font-light tracking-wide delay-200 md:text-3xl">
            以 AIGC 驱动的
            <span className="text-crimson mx-1 font-medium">高自由度</span>
            文字修仙
          </p>

          <div className="text-ink-muted fade-in-up mb-10 flex items-center justify-center gap-4 text-sm opacity-80 delay-300 md:text-base">
            <span>开源免费</span>
            <span className="bg-ink/30 h-1 w-1 rounded-full" />
            <span>无限剧情</span>
            <span className="bg-ink/30 h-1 w-1 rounded-full" />
            <span>独创功法</span>
          </div>

          <div className="fade-in-up flex flex-col items-center justify-center gap-5 delay-400 sm:flex-row">
            <Link href="/create" className="cta-button group">
              <span className="relative z-10">觉醒灵根</span>
              <div className="absolute inset-0 origin-left scale-x-0 rounded bg-white/20 transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
            <Link href="/game" className="cta-button-secondary group">
              <span>继续仙途</span>
            </Link>
          </div>
        </div>

        <ScrollHint />

        <div className="hero-decoration" />
      </section>

      {/* 简介区 */}
      <section className="ink-wash-bg relative px-4 py-20 md:py-28">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-block">
            <h2 className="font-heading text-ink section-title-decorated text-3xl md:text-5xl">
              大道三千，只取一瓢
            </h2>
          </div>

          <div className="text-ink space-y-6 text-lg leading-relaxed opacity-90 md:text-xl">
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
      <section id="features" className="scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="font-heading text-ink section-title-decorated text-3xl md:text-4xl">
              核心特色
            </h2>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`feature-card bg-paper ancient-border group p-8`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-ink group-hover:text-crimson mb-6 origin-center transform transition-transform duration-500 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="font-heading text-ink group-hover:text-crimson mb-4 text-2xl transition-colors">
                  {feature.title}
                </h3>
                <p className="text-ink-secondary text-sm leading-loose md:text-base">
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
        className="ink-wash-bg scroll-mt-20 px-4 py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-ink section-title-decorated text-3xl md:text-4xl">
              游戏一览
            </h2>
          </div>

          <ScreenshotGallery />

          <div className="mt-16 text-center">
            <Link
              href="/create"
              className="text-crimson hover:text-ink font-heading border-crimson/30 hover:border-ink inline-flex items-center gap-2 border-b pb-0.5 text-lg transition-colors"
            >
              <span>查看更多玩法说明</span>
              <svg
                className="h-4 w-4"
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
      <section id="updates" className="scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="font-heading text-ink section-title-decorated text-3xl md:text-4xl">
              仙界传书
            </h2>
            <p className="text-ink-muted mt-4 text-sm">LATEST UPDATES</p>
          </div>

          <div className="bg-paper border-ink/10 relative overflow-hidden rounded-lg border p-8 shadow-sm">
            {/* 装饰水印 */}
            <div className="pointer-events-none absolute top-0 right-0 rotate-12 transform p-16 opacity-[0.03]">
              <IconRoots className="text-ink h-64 w-64" />
            </div>

            <div className="relative z-10 space-y-2">
              {latestUpdates.map((log) => (
                <div key={log.version} className="timeline-item group">
                  <div className="timeline-dot group-hover:bg-crimson group-hover:scale-125"></div>
                  <div className="timeline-date">
                    {log.date} · {log.version}
                  </div>
                  <h3 className="text-ink group-hover:text-crimson mb-2 text-xl font-bold transition-colors">
                    {log.title}
                  </h3>
                  <ul className="list-none space-y-1">
                    {log.changes.slice(0, 2).map((change, i) => (
                      <li
                        key={i}
                        className="text-ink-secondary hover:border-ink/20 border-l-2 border-transparent pl-2 text-sm md:text-base"
                      >
                        {change}
                      </li>
                    ))}
                    {log.changes.length > 2 && (
                      <li className="text-ink-muted pt-1 text-xs">
                        ... 以及更多优化
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-ink/5 mt-8 border-t pt-8 text-center">
              <Link
                href="/changelog"
                className="cta-button-secondary px-6 py-2 text-sm"
              >
                查看全部更新日志
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="ink-wash-bg px-4 py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-heading text-ink mb-6 text-3xl md:text-5xl">
            即刻踏入仙途
          </h2>
          <p className="text-ink-secondary mb-10 text-lg">
            无需下载，点击即玩。
            <br />
            你的修仙传说，从此刻开始书写。
          </p>
          <Link
            href="/create"
            className="cta-button px-12 py-4 text-xl shadow-xl hover:-translate-y-1 hover:shadow-2xl"
          >
            立即开始
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-ink/10 bg-paper border-t px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 md:justify-start">
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

          <div className="text-ink-secondary flex gap-6 text-sm">
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
