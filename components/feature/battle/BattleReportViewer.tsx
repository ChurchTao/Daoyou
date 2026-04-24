import { useEffect, useRef } from 'react';
import type { BattleRecord } from '@/lib/services/battleResult';
import type { Cultivator } from '@/types/cultivator';

interface BattleReportViewerProps {
  displayReport: string;
  isStreaming: boolean;
  battleResult?: BattleRecord;
  player: Cultivator | null;
  isWin: boolean;
  // 挑战相关（可选）
  rankingUpdate?: {
    isWin: boolean;
    challengerRank: number | null;
    targetRank: number | null;
    remainingChallenges?: number;
  } | null;
}

/**
 * 战斗播报组件：显示战斗播报和结果
 */
export function BattleReportViewer({
  displayReport,
  isStreaming,
  battleResult,
  player,
  isWin,
  rankingUpdate,
}: BattleReportViewerProps) {
  const reportEndRef = useRef<HTMLDivElement>(null);

  // 流式输出时自动滚动到底部
  useEffect(() => {
    if (isStreaming) {
      reportEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayReport, isStreaming]);

  if (!displayReport) {
    return null;
  }

  return (
    <div className="battle-report animate-fade-in mt-2 mb-8 flex flex-col">
      {/* 播报内容容器 */}
      <div className="text-ink leading-relaxed overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
        {displayReport
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line, index) => (
            <p key={index} className="mb-4 whitespace-pre-line text-base md:text-lg">
              <span dangerouslySetInnerHTML={{ __html: line }} />
              {isStreaming &&
                index ===
                  displayReport.split('\n').filter((l) => l.trim() !== '')
                    .length -
                    1 && (
                  <span className="text-crimson ml-1 inline-block animate-pulse">
                    ▊
                  </span>
                )}
            </p>
          ))}
        <div ref={reportEndRef} />
      </div>

      {/* 结果标记 */}

      {!isStreaming && battleResult && (
        <>
          {/* 普通战斗的胜利标记 */}
          {isWin && !rankingUpdate && (
            <div className="mt-4 text-center">
              <p className="text-crimson text-lg font-semibold">
                最终，{player?.name} 获胜！
              </p>
            </div>
          )}

          {/* 挑战战斗的排名更新信息 */}
          {rankingUpdate && (
            <div className="mt-4 text-center">
              {isWin ? (
                <>
                  <p className="text-crimson mb-2 text-lg font-semibold">
                    最终，{player?.name} 获胜！
                  </p>
                  {rankingUpdate.challengerRank !== null && (
                    <p className="text-ink/80 text-sm">
                      你的排名已更新为第 {rankingUpdate.challengerRank} 名
                    </p>
                  )}
                  {rankingUpdate.remainingChallenges !== undefined && (
                    <p className="text-ink/60 mt-1 text-xs">
                      今日剩余挑战次数：{rankingUpdate.remainingChallenges}/10
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-ink/80 mb-2 text-lg font-semibold">
                    挑战失败
                  </p>
                  <p className="text-ink/60 text-sm">排名未变化，继续努力！</p>
                  {rankingUpdate.remainingChallenges !== undefined && (
                    <p className="text-ink/60 mt-1 text-xs">
                      今日剩余挑战次数：{rankingUpdate.remainingChallenges}/10
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
