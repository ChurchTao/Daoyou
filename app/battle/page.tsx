'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Cultivator } from '@/types/cultivator';
import { battle } from '@/utils/powerCalculator';
import { getDefaultBoss } from '@/utils/prompts';
import { VictorySeal, AnnotationIcon } from '@/components/SVGIcon';
import { mockRankings } from '@/data/mockRankings';

/**
 * 对战播报页内容组件
 */
function BattlePageContent() {
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<Cultivator | null>(null);
  const [battleResult, setBattleResult] = useState<{
    winner: Cultivator;
    loser: Cultivator;
    triggeredMiracle: boolean;
  } | null>(null);
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [finalReport, setFinalReport] = useState<string>(''); // 保存最终的完整播报
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);

  // 初始化
  useEffect(() => {
    const playerData = sessionStorage.getItem('player');
    if (playerData) {
      try {
        const playerObj = JSON.parse(playerData) as Cultivator;
        setPlayer(playerObj);
      } catch (e) {
        console.error('解析玩家数据失败:', e);
      }
    }

    const opponentId = searchParams.get('opponent');
    if (opponentId) {
      const foundOpponent = mockRankings.find((c) => c.id === opponentId);
      if (foundOpponent) {
        setOpponent(foundOpponent);
      } else {
        setOpponent(getDefaultBoss());
      }
    } else {
      setOpponent(getDefaultBoss());
    }
  }, [searchParams]);

  // 自动开始战斗
  useEffect(() => {
    if (player && opponent && !battleResult && !loading) {
      handleBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, opponent]);

  // 执行战斗
  const handleBattle = async () => {
    if (!player || !opponent) {
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setFinalReport(''); // 清空最终播报
    setBattleResult(null);

    try {
      const result = battle(player, opponent);
      setBattleResult(result);

      const response = await fetch('/api/generate-battle-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorA: player,
          cultivatorB: opponent,
          winner: result.winner,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成战斗播报失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                setIsStreaming(false);
                // 保存完整的播报内容，不清空
                setFinalReport(fullReport);
                setStreamingReport(fullReport);
              } else if (data.type === 'error') {
                throw new Error(data.error || '生成战斗播报失败');
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('战斗失败:', error);
      setIsStreaming(false);
      setStreamingReport('');
      setFinalReport('');
      alert(error instanceof Error ? error.message : '战斗失败');
    } finally {
      setLoading(false);
    }
  };

  // 再战一次
  const handleBattleAgain = () => {
    setBattleResult(null);
    setStreamingReport('');
    setFinalReport('');
    setIsStreaming(false);
    handleBattle();
  };

  if (!player) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-ink">未找到角色信息</p>
          <Link href="/create" className="btn-primary">
            创建角色
          </Link>
        </div>
      </div>
    );
  }

  const isWin = battleResult?.winner.id === player.id;
  // 优先显示流式内容，如果已完成则显示最终播报，否则显示简单结果
  const displayReport = streamingReport || finalReport || (battleResult ? `${battleResult.winner.name} 获胜！` : '');

  return (
    <div className="bg-paper min-h-screen p-4">
      <div className="container mx-auto max-w-2xl">
        {/* 标题 */}
        <div className="text-center mb-6">
          <h1 className="font-ma-shan-zheng text-2xl md:text-3xl text-ink mb-2">
            斗战纪
          </h1>
        </div>

        {/* 对战双方（左右分列，仿对战图谱） */}
        {player && opponent && (
          <div className="flex justify-between mb-8 px-4">
            <div className="text-center">
              <div className="font-ma-shan-zheng text-lg text-ink">
                {player.name}
              </div>
              <div className="text-xs text-ink/70 mt-1">
                {player.cultivationLevel}
              </div>
            </div>
            <div className="text-center text-ink/50">VS</div>
            <div className="text-center">
              <div className="font-ma-shan-zheng text-lg text-ink">
                {opponent.name}
              </div>
              <div className="text-xs text-ink/70 mt-1">
                {opponent.cultivationLevel}
              </div>
            </div>
          </div>
        )}

        {/* 战斗播报：仿古籍批注 */}
        {displayReport && (
          <div className="narrative-box max-w-lg mx-auto p-6 bg-paper-light border border-ink/10 rounded relative animate-fade-in">
            {/* 左侧朱批竖线 */}
            <div className="absolute left-2 top-2 bottom-2 flex items-center">
              <AnnotationIcon className="w-4 h-full" />
            </div>

            {/* 播报内容 */}
            <p className="text-ink leading-relaxed text-center whitespace-pre-line pl-4">
              {displayReport}
              {isStreaming && (
                <span className="inline-block ml-1 animate-pulse text-crimson">▊</span>
              )}
            </p>

            {/* 顿悟提示 */}
            {battleResult?.triggeredMiracle && (
              <div className="mt-4 text-center text-crimson text-sm font-semibold">
                ✨ 触发顿悟！逆天改命！
              </div>
            )}

            {/* 胜利印章（条件渲染） */}
            {isWin && !isStreaming && battleResult && (
              <div className="absolute -top-4 -right-4 animate-slide-down">
                <VictorySeal />
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {battleResult && !isStreaming && (
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleBattleAgain} className="btn-outline">
              再战
            </button>
            <Link href="/" className="btn-primary">
              载入道录
            </Link>
            <button
              onClick={() => {
                alert('分享功能开发中...');
              }}
              className="btn-outline flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              分享
            </button>
          </div>
        )}

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-sm text-ink/50 hover:text-ink/70 transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 对战播报页
 * 目标：制造爽感 + 可分享
 */
export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink">加载中...</p>
          </div>
        </div>
      }
    >
      <BattlePageContent />
    </Suspense>
  );
}
