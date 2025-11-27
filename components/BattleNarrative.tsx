'use client';

import { AncientBookIcon } from './SVGIcon';

interface BattleNarrativeProps {
  report: string;
  isStreaming?: boolean;
  winner?: string;
  triggeredMiracle?: boolean;
}

/**
 * 战斗播报组件
 * 显示小说式的战斗描述
 */
export default function BattleNarrative({
  report,
  isStreaming = false,
  winner,
  triggeredMiracle,
}: BattleNarrativeProps) {
  return (
    <div className="relative rounded-lg border border-ink/10 bg-paper-light p-6 shadow-lg">
      {/* 古籍装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-2 right-2 opacity-5">
          <AncientBookIcon className="w-16 h-16" />
        </div>
      </div>

      {/* 播报内容 */}
      <div className="relative min-h-[200px]">
        <div className="text-lg leading-relaxed text-ink whitespace-pre-wrap pl-4">
          {report}
          {isStreaming && (
            <span className="inline-block ml-1 animate-pulse text-crimson">▊</span>
          )}
        </div>

        {/* 顿悟提示 */}
        {triggeredMiracle && (
          <div className="mt-4 text-center text-crimson text-sm font-semibold">
            ✨ 触发顿悟！逆天改命！
          </div>
        )}
      </div>
    </div>
  );
}

