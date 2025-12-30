'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { BattleReportViewer } from '@/components/feature/battle/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/feature/battle/BattleTimelineViewer';
import type { BattleEngineResult } from '@/engine/battle';
import type { Cultivator } from '@/types/cultivator';
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
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [opponentLoading, setOpponentLoading] = useState(false);
  const [opponentError, setOpponentError] = useState<string>();
  const [battleEnd, setBattleEnd] = useState(false);

  // 初始化 & 自动开始战斗
  useEffect(() => {
    const opponentId = searchParams.get('opponent');

    const init = async () => {
      // 1. 并行获取数据
      const fetchPlayerData = async () => {
        setPlayerLoading(true);
        try {
          const res = await fetch('/api/cultivators');
          const json = await res.json();
          if (json.success && json.data.length > 0) {
            setPlayer(json.data[0]);
            return json.data[0];
          }
        } catch (e) {
          console.error('获取玩家数据失败', e);
        } finally {
          setPlayerLoading(false);
        }
        return null;
      };

      const fetchOpponentData = async () => {
        if (!opponentId) {
          setOpponentError('天机未定，对手无踪，难启杀局。');
          return null;
        }
        setOpponentLoading(true);
        setOpponentError(undefined);
        try {
          const res = await fetch(`/api/enemies/${opponentId}`);
          const json = await res.json();
          if (res.ok && json.success) {
            setOpponent(json.data);
            return json.data;
          } else {
            throw new Error(json.error || 'fetch_failed');
          }
        } catch (e) {
          console.error('获取对手数据失败', e);
          const errMsg =
            e instanceof Error && e.message === 'missing_opponent'
              ? '天机未定，对手无踪，难启杀局。'
              : '天机逆乱，对手行迹莫测，战不可开。';
          setOpponentError(errMsg);
        } finally {
          setOpponentLoading(false);
        }
        return null;
      };

      // 2. 执行请求
      const [pData, oData] = await Promise.all([
        fetchPlayerData(),
        fetchOpponentData(),
      ]);

      // 3. 如果数据都存在且没有之前的战斗结果，自动开始
      if (pData && oData && !battleResult && !loading) {
        handleBattle(pData.id, oData.id);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 执行战斗（使用合并接口）
  const handleBattle = async (pId?: string, oId?: string) => {
    // 优先使用参数ID，其次使用状态ID
    const currentPid = pId || player?.id;
    const currentOid = oId || opponent?.id;

    if (!currentPid || !currentOid) {
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setBattleResult(undefined);

    try {
      // 调用合并的战斗接口（执行战斗并生成播报）
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: currentPid,
          opponentId: currentOid,
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
              } else if (data.type === 'chunk') {
                // 接收播报内容块
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                // 播报生成完成
                setIsStreaming(false);
                setStreamingReport(fullReport);
                setBattleEnd(true);
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
      alert(error instanceof Error ? error.message : '战斗失败');
    } finally {
      setLoading(false);
    }
  };

  // 再战一次
  const handleBattleAgain = () => {
    setBattleResult(undefined);
    setStreamingReport('');
    setIsStreaming(false);
    handleBattle();
  };

  if (playerLoading || opponentLoading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink">加载中...</p>
        </div>
      </div>
    );
  }

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

  const isWin = battleResult?.winner.id === player?.id;
  const displayReport = streamingReport;
  const opponentName = opponent?.name ?? '神秘对手';

  return (
    <BattlePageLayout
      title={`【战报 · ${player?.name} vs ${opponentName}】`}
      backHref="/"
      error={opponentError}
      loading={loading}
      battleResult={battleResult}
      isStreaming={isStreaming}
      actions={{
        primary: {
          label: '返回主界',
          href: '/',
        },
        secondary: [
          {
            label: '再战',
            onClick: handleBattleAgain,
          },
          {
            label: '分享战报',
            onClick: () => {
              alert('分享功能开发中...');
            },
          },
        ],
      }}
    >
      {/* 数值战斗回放 */}
      {battleResult?.timeline &&
        battleResult.timeline.length > 0 &&
        opponent &&
        (isStreaming || battleEnd) && (
          <BattleTimelineViewer
            battleResult={battleResult}
            playerName={player.name}
            opponentName={opponent.name}
          />
        )}

      {/* 战斗播报 */}
      <BattleReportViewer
        displayReport={displayReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={isWin}
      />
    </BattlePageLayout>
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
