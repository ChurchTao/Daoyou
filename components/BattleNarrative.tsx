'use client';

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
    <div className="relative rounded-lg border-2 border-[#e0c5a3]/30 bg-gradient-to-br from-[#0d1b2a]/90 to-[#1a2a3a]/90 backdrop-blur-sm p-6 shadow-xl">
      {/* 卷轴装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#e0c5a3]/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#e0c5a3]/20 to-transparent"></div>
      </div>

      {/* 播报内容 */}
      <div className="relative min-h-[200px]">
        <div className="text-lg leading-relaxed text-[#e0c5a3] whitespace-pre-wrap font-serif">
          {report}
          {isStreaming && (
            <span className="inline-block ml-1 animate-pulse text-[#4cc9f0]">▊</span>
          )}
        </div>

        {/* 顿悟提示 */}
        {triggeredMiracle && (
          <div className="mt-4 flex items-center gap-2 text-yellow-400">
            <span className="text-2xl animate-pulse">✨</span>
            <span className="font-bold">触发顿悟！逆天改命！</span>
          </div>
        )}

        {/* 结果标识 */}
        {winner && !isStreaming && (
          <div className="mt-6 text-center">
            <div className="inline-block rounded-full px-6 py-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-2 border-yellow-400/50">
              <span className="text-2xl mr-2">🎉</span>
              <span className="text-xl font-bold text-yellow-400">
                {winner} 获胜！
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

