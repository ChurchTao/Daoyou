import { InkButton } from '@/components/ui/InkButton';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '误入虚空 - 万界道友',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="bg-paper min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden relative">
      {/* 水墨装饰背景效果 */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ink rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-crimson rounded-full blur-[100px] opacity-30" />
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* 404 数字装饰 */}
        <h1 className="font-heading text-9xl text-ink/10 select-none mb-[-2rem]">
          404
        </h1>
        
        <div className="mb-8">
          <h2 className="font-heading text-4xl text-ink mb-4">
            缘分未至，误入虚空
          </h2>
          <div className="w-16 h-1 bg-crimson mx-auto mb-6" />
          <p className="text-ink-secondary text-lg leading-relaxed">
            道友请留步。此处乃天地裂隙，神识所及尽是虚无。
            <br />
            你寻觅的机缘或许已随天机隐去，亦或尚未在此界显现。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
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
            className="text-ink-muted text-sm hover:text-crimson transition-colors border-b border-ink-muted/30 pb-0.5"
          >
            向天机阁反馈（报告 Bug）
          </Link>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-ink/20 to-transparent" />
    </div>
  );
}
