'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import type { Cultivator } from '@/types/cultivator';
import { getDefaultBoss } from '@/utils/prompts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * 敌人数据类型（简化版）
 */
type EnemyData = {
  id: string;
  name: string;
  realm: string;
  realm_stage: string;
  spiritual_roots: Array<{ element: string; strength: number }>;
  background?: string;
  combatRating: number;
};

/**
 * 对战播报页内容组件
 */
function BattlePageContent() {
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<EnemyData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult | null>(
    null,
  );
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [finalReport, setFinalReport] = useState<string>(''); // 保存最终的完整播报
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [opponentLoading, setOpponentLoading] = useState(false);

  // 初始化
  useEffect(() => {
    // 获取玩家角色
    const fetchPlayer = async () => {
      setPlayerLoading(true);
      try {
        const playerResponse = await fetch('/api/cultivators');
        const playerResult = await playerResponse.json();
        
        if (playerResult.success && playerResult.data.length > 0) {
          setPlayer(playerResult.data[0]);
        }
      } catch (error) {
        console.error('获取玩家数据失败:', error);
      } finally {
        setPlayerLoading(false);
      }
    };
    
    // 获取对手角色
    const fetchOpponent = async () => {
      setOpponentLoading(true);
      try {
        const opponentId = searchParams.get('opponent');
        if (opponentId) {
          // 从敌人API获取对手数据
          const enemyResponse = await fetch(`/api/enemies/${opponentId}`);
          const enemyResult = await enemyResponse.json();
          
          if (enemyResult.success) {
            setOpponent(enemyResult.data);
          } else {
            // 如果获取失败，使用默认BOSS
            const defaultBoss = getDefaultBoss();
            const { vitality, spirit, wisdom, speed, willpower } = defaultBoss.attributes;
            setOpponent({
              id: defaultBoss.id!,
              name: defaultBoss.name,
              realm: defaultBoss.realm,
              realm_stage: defaultBoss.realm_stage,
              spiritual_roots: defaultBoss.spiritual_roots,
              background: defaultBoss.background,
              combatRating: Math.round((vitality + spirit + wisdom + speed + willpower) / 5) || 0
            });
          }
        } else {
          // 如果没有对手ID，使用默认BOSS
          const defaultBoss = getDefaultBoss();
          const { vitality, spirit, wisdom, speed, willpower } = defaultBoss.attributes;
          setOpponent({
            id: defaultBoss.id!,
            name: defaultBoss.name,
            realm: defaultBoss.realm,
            realm_stage: defaultBoss.realm_stage,
            spiritual_roots: defaultBoss.spiritual_roots,
            background: defaultBoss.background,
            combatRating: Math.round((vitality + spirit + wisdom + speed + willpower) / 5) || 0
          });
        }
      } catch (error) {
        console.error('获取对手数据失败:', error);
        // 使用默认BOSS
        const defaultBoss = getDefaultBoss();
        const { vitality, spirit, wisdom, speed, willpower } = defaultBoss.attributes;
        setOpponent({
          id: defaultBoss.id!,
          name: defaultBoss.name,
          realm: defaultBoss.realm,
          realm_stage: defaultBoss.realm_stage,
          spiritual_roots: defaultBoss.spiritual_roots,
          background: defaultBoss.background,
          combatRating: Math.round((vitality + spirit + wisdom + speed + willpower) / 5) || 0
        });
      } finally {
        setOpponentLoading(false);
      }
    };
    
    fetchPlayer();
    fetchOpponent();
  }, [searchParams]);

  // 自动开始战斗
  useEffect(() => {
    if (player && opponent && !battleResult && !loading && !playerLoading && !opponentLoading) {
      handleBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, opponent, battleResult, loading, playerLoading, opponentLoading]);

  // 执行战斗（使用合并接口）
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
      // 调用合并的战斗接口（执行战斗并生成播报）
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: player.id,
          opponentId: opponent.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '战斗失败');
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

              if (data.type === 'battle_result') {
                // 接收战斗结果数据
                const result = data.data;
                setBattleResult({
                  winner: result.winner,
                  loser: result.loser,
                  log: result.log,
                  turns: result.turns,
                  playerHp: result.playerHp,
                  opponentHp: result.opponentHp,
                });
                console.log("战斗结果：",result);
              } else if (data.type === 'chunk') {
                // 接收播报内容块
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                // 播报生成完成
                setIsStreaming(false);
                setFinalReport(fullReport);
                setStreamingReport(fullReport);
              } else if (data.type === 'error') {
                throw new Error(data.error || '战斗失败');
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
  const displayReport =
    streamingReport ||
    finalReport ||
    (battleResult ? `${battleResult.winner.name} 获胜！` : '');

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto flex max-w-xl flex-col px-4 pt-8 pb-16 main-content">
        {/* 返回按钮 */}
        <Link href="/" className="mb-4 text-ink transition hover:text-crimson">
          [← 返回]
        </Link>

        {/* 标题 */}
        <div className="mb-6 text-center">
          <h1 className="font-ma-shan-zheng text-2xl text-ink">
            【战报 · {player?.name} vs {opponent?.name}】
          </h1>
        </div>

        {/* 战斗播报：全屏展示 AIGC 生成的战报 */}
        {displayReport && (
          <div className="battle-report mb-8 rounded-lg border border-ink/10 bg-paper-light p-6 animate-fade-in">
            {/* 播报内容 */}
            <div className="text-ink leading-relaxed">
              {displayReport
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line">
                    <span dangerouslySetInnerHTML={{ __html: line }} />
                    {isStreaming &&
                      index === displayReport.split('\n').filter(l => l.trim() !== '').length - 1 && (
                        <span className="inline-block ml-1 animate-pulse text-crimson">
                          ▊
                        </span>
                      )}
                  </p>
                ))}
            </div>

            {/* 胜利标记 */}
            {isWin && !isStreaming && battleResult && (
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold text-crimson">
                  最终，{player?.name} 获胜！
                </p>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {battleResult && !isStreaming && (
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={handleBattleAgain} className="btn-outline">
              [再战]
            </button>
            <Link href="/" className="btn-primary">
              [返回主界]
            </Link>
            <button
              onClick={() => {
                alert('分享功能开发中...');
              }}
              className="btn-outline"
            >
              [分享战报]
            </button>
          </div>
        )}

        {/* 加载中提示 */}
        {loading && !battleResult && (
          <div className="text-center">
            <p className="loading-tip">正在推演天机……</p>
          </div>
        )}
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
