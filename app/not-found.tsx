import { InkButton } from '@/components/ui/InkButton';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '误入虚空 - 万界道友',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="bg-paper relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* 水墨装饰背景效果 */}
      <div className="pointer-events-none absolute inset-0 opacity-5">
        <div className="bg-ink absolute top-1/4 left-1/4 h-96 w-96 animate-pulse rounded-full blur-[100px]" />
        <div className="bg-crimson absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full opacity-30 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg text-center">
        {/* 404 数字装饰 */}
        <h1 className="font-heading text-ink/10 mb-[-2rem] text-9xl select-none">
          404
        </h1>

        <div className="mb-8">
          <h2 className="font-heading text-ink mb-4 text-4xl">
            缘分未至，误入虚空
          </h2>
          <div className="bg-crimson mx-auto mb-6 h-1 w-16" />
          <p className="text-ink-secondary text-lg leading-relaxed">
            道友请留步。此处乃天地裂隙，神识所及尽是虚无。
            <br />
            你寻觅的机缘或许已随天机隐去，亦或尚未在此界显现。
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <InkButton variant="primary" href="/">
            重返仙界（首页）
          </InkButton>
          <InkButton variant="secondary" href="/game">
            继续仙途
          </InkButton>
        </div>

        <div className="mt-12">
          <Link
            href="https://github.com/ChurchTao/wanjiedaoyou"
            className="text-ink-muted hover:text-crimson border-ink-muted/30 border-b pb-0.5 text-sm transition-colors"
          >
            向天机阁反馈（报告 Bug）
          </Link>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="via-ink/20 fixed bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}
