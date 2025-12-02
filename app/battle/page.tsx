'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import type { Cultivator, Consumable } from '@/types/cultivator';
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
  appearance?: string;
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
            setOpponent({
              id: defaultBoss.id!,
              name: defaultBoss.name,
              realm: defaultBoss.realm,
              realm_stage: defaultBoss.realm_stage,
              spiritual_roots: defaultBoss.spiritual_roots,
              background: defaultBoss.background,
              combatRating: Math.round(
                (defaultBoss.attributes.vitality + 
                 defaultBoss.attributes.spirit + 
                 defaultBoss.attributes.wisdom + 
                 defaultBoss.attributes.speed +
                 defaultBoss.attributes.willpower) / 5
              ) || 0
            });
          }
        } else {
          // 如果没有对手ID，使用默认BOSS
          const defaultBoss = getDefaultBoss();
          setOpponent({
            id: defaultBoss.id!,
            name: defaultBoss.name,
            realm: defaultBoss.realm,
            realm_stage: defaultBoss.realm_stage,
            spiritual_roots: defaultBoss.spiritual_roots,
            background: defaultBoss.background,
            combatRating: Math.round(
              (defaultBoss.attributes.vitality + 
               defaultBoss.attributes.spirit + 
               defaultBoss.attributes.wisdom + 
               defaultBoss.attributes.speed +
               defaultBoss.attributes.willpower) / 5
            ) || 0
          });
        }
      } catch (error) {
        console.error('获取对手数据失败:', error);
        // 使用默认BOSS
        const defaultBoss = getDefaultBoss();
        setOpponent({
          id: defaultBoss.id!,
          name: defaultBoss.name,
          realm: defaultBoss.realm,
          realm_stage: defaultBoss.realm_stage,
          spiritual_roots: defaultBoss.spiritual_roots,
          background: defaultBoss.background,
          combatRating: Math.round(
            (defaultBoss.attributes.vitality + 
             defaultBoss.attributes.spirit + 
             defaultBoss.attributes.wisdom + 
             defaultBoss.attributes.speed +
             defaultBoss.attributes.willpower) / 5
          ) || 0
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
      // 从URL参数获取消耗品ID列表
      const consumablesParam = searchParams.get('consumables');
      const consumableIds = consumablesParam ? consumablesParam.split(',') : [];
      
      // 调用后端战斗引擎API
      const battleResponse = await fetch('/api/generate-battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: player.id,
          opponentId: opponent.id,
          consumableIds: consumableIds,
        }),
      });

      if (!battleResponse.ok) {
        const errorData = await battleResponse.json();
        throw new Error(errorData.error || '生成战斗结果失败');
      }

      const battleResultData = await battleResponse.json();
      const result = battleResultData.data;
      console.log('战斗结果:', result);
      setBattleResult(result);

      const response = await fetch('/api/generate-battle-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player,
          opponent,
          battleSummary: {
            winnerId: result.winner.id,
            log: result.log,
            turns: result.turns,
            playerHp: result.playerHp,
            opponentHp: result.opponentHp,
            triggeredMiracle: result.triggeredMiracle,
          },
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
  const displayReport =
    streamingReport ||
    finalReport ||
    (battleResult ? `${battleResult.winner.name} 获胜！` : '');

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
                {player.realm}{player.realm_stage}
              </div>
            </div>
            <div className="text-center text-ink/50">VS</div>
            <div className="text-center">
              <div className="font-ma-shan-zheng text-lg text-ink">
                {opponent.name}
              </div>
              <div className="text-xs text-ink/70 mt-1">
                {opponent.realm}{opponent.realm_stage}
              </div>
            </div>
          </div>
        )}

        {/* 战斗播报：仿古籍批注 */}
        {displayReport && (
          <div className="battle-report max-w-lg mx-auto p-6 bg-paper-light border border-ink/10 rounded animate-fade-in">
            {/* 播报标题 */}
            <h2 className="font-ma-shan-zheng text-xl text-ink mb-4 text-center">
              战报 · {player?.name} vs {opponent?.name}
            </h2>
            
            {/* 播报内容 */}
            <div className="text-ink leading-relaxed text-center">
              {displayReport
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line">
                    <span dangerouslySetInnerHTML={{ __html: line }} />
                    {isStreaming &&
                      index === displayReport.split('\n').length - 2 && (
                        <span className="inline-block ml-1 animate-pulse text-crimson">
                          ▊
                        </span>
                      )}
                  </p>
                ))}
            </div>


            {/* 胜利印章（条件渲染） */}
            {isWin && !isStreaming && battleResult && (
              <div className="absolute -top-4 -right-4 animate-slide-down text-4xl font-bold text-crimson opacity-80">
                胜
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {battleResult && !isStreaming && (
          <div className="flex flex-wrap justify-center gap-4 mt-8">
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

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-ink hover:underline"
          >
            [← 返回主界]
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
