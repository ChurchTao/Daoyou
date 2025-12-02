'use client';

import { InkButton } from '@/components/InkComponents';
import type { BattleEngineResult } from '@/engine/battleEngine';
import { StatusEffect } from '@/types/constants';
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
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [autoPlayTurn, setAutoPlayTurn] = useState(true);

  const STATUS_LABELS: Record<StatusEffect, string> = {
    burn: '灼烧',
    bleed: '流血',
    poison: '中毒',
    stun: '眩晕',
    silence: '沉默',
    root: '定身',
    armor_up: '护体',
    speed_up: '疾速',
    crit_rate_up: '会心',
    armor_down: '破防',
  };

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
            const { vitality, spirit, wisdom, speed, willpower } =
              defaultBoss.attributes;
            setOpponent({
              id: defaultBoss.id!,
              name: defaultBoss.name,
              realm: defaultBoss.realm,
              realm_stage: defaultBoss.realm_stage,
              spiritual_roots: defaultBoss.spiritual_roots,
              background: defaultBoss.background,
              combatRating:
                Math.round(
                  (vitality + spirit + wisdom + speed + willpower) / 5,
                ) || 0,
            });
          }
        } else {
          // 如果没有对手ID，使用默认BOSS
          const defaultBoss = getDefaultBoss();
          const { vitality, spirit, wisdom, speed, willpower } =
            defaultBoss.attributes;
          setOpponent({
            id: defaultBoss.id!,
            name: defaultBoss.name,
            realm: defaultBoss.realm,
            realm_stage: defaultBoss.realm_stage,
            spiritual_roots: defaultBoss.spiritual_roots,
            background: defaultBoss.background,
            combatRating:
              Math.round(
                (vitality + spirit + wisdom + speed + willpower) / 5,
              ) || 0,
          });
        }
      } catch (error) {
        console.error('获取对手数据失败:', error);
        // 使用默认BOSS
        const defaultBoss = getDefaultBoss();
        const { vitality, spirit, wisdom, speed, willpower } =
          defaultBoss.attributes;
        setOpponent({
          id: defaultBoss.id!,
          name: defaultBoss.name,
          realm: defaultBoss.realm,
          realm_stage: defaultBoss.realm_stage,
          spiritual_roots: defaultBoss.spiritual_roots,
          background: defaultBoss.background,
          combatRating:
            Math.round((vitality + spirit + wisdom + speed + willpower) / 5) ||
            0,
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
    if (
      player &&
      opponent &&
      !battleResult &&
      !loading &&
      !playerLoading &&
      !opponentLoading
    ) {
      handleBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, opponent, battleResult, loading, playerLoading, opponentLoading]);

  // 战斗结果到达后，重置回合播放
  useEffect(() => {
    if (battleResult?.timeline && battleResult.timeline.length > 0) {
      setCurrentTurnIndex(0);
      setAutoPlayTurn(true);
    }
  }, [battleResult?.timeline]);

  // 回合自动播放，营造停顿感
  useEffect(() => {
    if (!autoPlayTurn || !battleResult?.timeline) return;
    const total = battleResult.timeline.length;
    if (total === 0) return;

    const timer = setInterval(() => {
      setCurrentTurnIndex((idx) => {
        if (idx >= total - 1) return idx;
        return idx + 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [autoPlayTurn, battleResult?.timeline]);

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
                  timeline: result.timeline ?? [],
                });
                console.log('战斗结果：', result);
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

        {/* 数值战斗回放：HP / MP / 状态随回合变化（遵循极简文字 UI 规范） */}
        {battleResult?.timeline &&
          battleResult.timeline.length > 0 &&
          opponent && (
            <div className="mb-8 p-4">
              {(() => {
                const snaps = battleResult.timeline;
                const first = snaps[0];
                const maxPlayerHp = first?.player.hp || 1;
                const maxOpponentHp = first?.opponent.hp || 1;
                const maxPlayerMp = first?.player.mp || 1;
                const maxOpponentMp = first?.opponent.mp || 1;
                const totalTurns = snaps.length;
                const safeIndex = Math.min(
                  Math.max(currentTurnIndex, 0),
                  totalTurns - 1,
                );
                const snap = snaps[safeIndex];

                const renderStatusList = (statuses: StatusEffect[]) =>
                  statuses.length
                    ? statuses.map((s) => STATUS_LABELS[s] ?? s).join('、')
                    : '无';

                return (
                  <>
                    {/* 顶部：回合信息 + 播放控制（纯文字与符号） */}
                    <div className="mb-2 flex items-center justify-between text-sm text-ink/80">
                      <span className="tracking-wide">
                        {snap.turn === 0
                          ? '[战前状态]'
                          : `回合: ${snap.turn} / ${
                              battleResult.turns ?? snap.turn
                            }`}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-ink/60 hover:text-ink"
                          onClick={() => {
                            setAutoPlayTurn(false);
                            setCurrentTurnIndex((idx) => Math.max(0, idx - 1));
                          }}
                        >
                          ‹ 上一回合
                        </button>
                        <button
                          type="button"
                          className="text-ink/60 hover:text-ink"
                          onClick={() => setAutoPlayTurn((v) => !v)}
                        >
                          {autoPlayTurn ? '⏸ 暂停' : '▶ 播放'}
                        </button>
                        <button
                          type="button"
                          className="text-ink/60 hover:text-ink"
                          onClick={() => {
                            setAutoPlayTurn(false);
                            setCurrentTurnIndex((idx) =>
                              Math.min(totalTurns - 1, idx + 1),
                            );
                          }}
                        >
                          下一回合 ›
                        </button>
                      </div>
                    </div>

                    {/* 中部：左右文字排版展示双方数值与状态 */}
                    <div className="mt-2 border-t border-dashed border-ink/20 pt-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        {/* 左侧：玩家 */}
                        <div className="flex-1 leading-relaxed">
                          <div className="mb-1 font-semibold text-ink">
                            {player.name}
                          </div>
                          <div className="mb-0.5 text-ink/80">
                            气血：{snap.player.hp}/{maxPlayerHp}
                          </div>
                          <div className="mb-0.5 text-ink/80">
                            灵力：{snap.player.mp}/{maxPlayerMp}
                          </div>
                          <div className="text-ink/70">
                            状态：{renderStatusList(snap.player.statuses)}
                          </div>
                        </div>

                        {/* 右侧：对手 */}
                        <div className="flex-1 text-right leading-relaxed">
                          <div className="mb-1 font-semibold text-ink">
                            {opponent.name}
                          </div>
                          <div className="mb-0.5 text-ink/80">
                            气血：{snap.opponent.hp}/{maxOpponentHp}
                          </div>
                          <div className="mb-0.5 text-ink/80">
                            灵力：{snap.opponent.mp}/{maxOpponentMp}
                          </div>
                          <div className="text-ink/70">
                            状态：{renderStatusList(snap.opponent.statuses)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        {/* 战斗播报：全屏展示 AIGC 生成的战报 */}
        {displayReport && (
          <div className="battle-report mt-2 mb-8 animate-fade-in">
            {/* 播报内容 */}
            <div className="text-ink leading-relaxed">
              {displayReport
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line">
                    <span dangerouslySetInnerHTML={{ __html: line }} />
                    {isStreaming &&
                      index ===
                        displayReport.split('\n').filter((l) => l.trim() !== '')
                          .length -
                          1 && (
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
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
            <InkButton onClick={handleBattleAgain}>再战</InkButton>
            <InkButton href="/" variant="primary">
              返回主界
            </InkButton>
            <InkButton
              onClick={() => {
                alert('分享功能开发中...');
              }}
            >
              分享战报
            </InkButton>
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
