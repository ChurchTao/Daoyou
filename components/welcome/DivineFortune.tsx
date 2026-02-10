'use client';

import { useDivineFortune } from '@/lib/hooks/useDivineFortune';
import { cn } from '@/lib/utils';
import { TypewriterText } from './TypewriterText';

interface DivineFortuneProps {
  className?: string;
  onComplete?: () => void;
  showImmediately?: boolean; // 是否立即显示（跳过打字机效果）
  startDelay?: number; // 延迟开始时间（ms）
}

/**
 * 天机推演显示组件
 * 显示 AIGC 生成的天机格言
 */
export function DivineFortune({
  className,
  onComplete,
  showImmediately = false,
  startDelay = 0,
}: DivineFortuneProps) {
  const { fortune, isLoading } = useDivineFortune();

  if (isLoading) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <p className="animate-pulse text-lg text-amber-800/60">
          正在推演天机……
        </p>
      </div>
    );
  }

  if (!fortune) {
    return null;
  }

  return (
    <div className={cn('divine-fortune space-y-3 text-center', className)}>
      {/* 标题 */}
      <div className="mb-4 text-sm tracking-widest text-amber-900/70">
        ◆ 今日天机 ◆
      </div>

      {/* 天机格言 */}
      <TypewriterText
        text={fortune.fortune}
        speed={100}
        startDelay={startDelay}
        enabled={!showImmediately}
        className="block text-lg italic"
      />

      {/* 提示 */}
      <TypewriterText
        text={fortune.hint}
        speed={100}
        startDelay={
          showImmediately ? 0 : startDelay + fortune.fortune.length * 100 + 300
        }
        enabled={!showImmediately}
        onComplete={onComplete}
        className="block text-lg"
      />

      {/* 装饰性分隔线 */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <div className="h-px w-12 bg-linear-to-r from-transparent to-amber-900/30" />
        <div className="text-xs text-amber-900/40">☯</div>
        <div className="h-px w-12 bg-linear-to-l from-transparent to-amber-900/30" />
      </div>
    </div>
  );
}
