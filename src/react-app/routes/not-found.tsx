import { InkButton } from '@app/components/ui/InkButton';
import Link from '@app/components/router/AppLink';

export default function NotFound() {
  return (
    <div className="bg-paper relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <div className="text-ink/10 absolute top-16 left-8 text-7xl">「虚」</div>
        <div className="text-crimson/10 absolute right-8 bottom-20 text-8xl">
          「空」
        </div>
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
          <div className="text-crimson mx-auto mb-6 text-sm tracking-[0.35em]">
            ┈┈┈
          </div>
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

      <div className="border-ink/15 fixed right-0 bottom-0 left-0 border-t border-dashed" />
    </div>
  );
}
