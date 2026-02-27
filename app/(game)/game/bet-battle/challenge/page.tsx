'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { BattleReportViewer } from '@/components/feature/battle/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/feature/battle/BattleTimelineViewer';
import { InkButton } from '@/components/ui/InkButton';
import type { BattleEngineResult } from '@/engine/battle';
import type { Cultivator } from '@/types/cultivator';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

type SettlementState = {
  isWin: boolean;
  winnerId: string;
  battleId: string;
  battleRecordId: string;
  resultMessage: string;
};

function isBattleResultPayload(
  data: unknown,
): data is { type: 'battle_result'; data: BattleEngineResult } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'battle_result' &&
    'data' in data
  );
}

function isSettlementPayload(
  data: unknown,
): data is { type: 'bet_battle_settlement' } & SettlementState {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('type' in data) ||
    data.type !== 'bet_battle_settlement'
  ) {
    return false;
  }

  return (
    'isWin' in data &&
    typeof data.isWin === 'boolean' &&
    'winnerId' in data &&
    typeof data.winnerId === 'string' &&
    'battleId' in data &&
    typeof data.battleId === 'string' &&
    'battleRecordId' in data &&
    typeof data.battleRecordId === 'string' &&
    'resultMessage' in data &&
    typeof data.resultMessage === 'string'
  );
}

function BetBattleChallengePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<Cultivator | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [battleEnd, setBattleEnd] = useState(false);
  const [settlement, setSettlement] = useState<SettlementState | null>(null);

  const hasBattleStarted = useRef(false);

  const battleId = searchParams.get('battleId');
  const stakeType = searchParams.get('stakeType');
  const spiritStones = Number(searchParams.get('spiritStones') ?? '0');
  const itemType = searchParams.get('itemType');
  const itemId = searchParams.get('itemId');
  const quantity = Number(searchParams.get('quantity') ?? '1');

  useEffect(() => {
    if (hasBattleStarted.current) return;
    hasBattleStarted.current = true;
    void handleChallengeBattle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChallengeBattle = async () => {
    if (!battleId) {
      setError('缺少赌战ID，无法应战');
      return;
    }

    if (stakeType !== 'spirit_stones' && stakeType !== 'item') {
      setError('押注类型无效');
      return;
    }

    if (
      stakeType === 'item' &&
      (!itemType || !itemId || !Number.isFinite(quantity) || quantity < 1)
    ) {
      setError('应战押注参数不完整');
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setBattleResult(undefined);
    setError(undefined);
    setSettlement(null);
    setBattleEnd(false);

    try {
      const response = await fetch(`/api/bet-battles/${battleId}/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stakeType,
          spiritStones: stakeType === 'spirit_stones' ? spiritStones : 0,
          stakeItem:
            stakeType === 'item' && itemType && itemId
              ? {
                  itemType,
                  itemId,
                  quantity,
                }
              : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '应战失败');
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
          if (!line.startsWith('data: ')) continue;

          let data: unknown;
          try {
            data = JSON.parse(line.slice(6));
          } catch (parseError) {
            console.error('解析 SSE 数据失败:', parseError);
            continue;
          }

          if (
            typeof data !== 'object' ||
            data === null ||
            !('type' in data) ||
            typeof data.type !== 'string'
          ) {
            continue;
          }

          if (isBattleResultPayload(data)) {
            const result = data.data;
            setBattleResult({
              winner: result.winner,
              loser: result.loser,
              log: result.log,
              turns: result.turns,
              playerHp: result.playerHp,
              opponentHp: result.opponentHp,
              timeline: result.timeline ?? [],
              player: result.player,
              opponent: result.opponent,
            });

            const isPlayerWin = result.winner.id === result.player;
            const playerInfo = isPlayerWin ? result.winner : result.loser;
            const opponentInfo = isPlayerWin ? result.loser : result.winner;
            setPlayer(playerInfo);
            setOpponent(opponentInfo);
          } else if (data.type === 'chunk') {
            const chunk = (data as { content?: string }).content;
            if (chunk) {
              fullReport += chunk;
              setStreamingReport(fullReport);
            }
          } else if (isSettlementPayload(data)) {
            setSettlement({
              isWin: data.isWin,
              winnerId: data.winnerId,
              battleId: data.battleId,
              battleRecordId: data.battleRecordId,
              resultMessage: data.resultMessage,
            });
          } else if (data.type === 'done') {
            setIsStreaming(false);
            setStreamingReport(fullReport);
            setBattleEnd(true);
          } else if (data.type === 'error') {
            const message =
              (data as { error?: string }).error || '应战失败，请稍后重试';
            throw new Error(message);
          }
        }
      }
    } catch (requestError) {
      console.error('应战赌战失败:', requestError);
      setIsStreaming(false);
      setStreamingReport('');
      setError(
        requestError instanceof Error
          ? requestError.message
          : '应战失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => router.push('/game/bet-battle')}>
            返回赌战台
          </InkButton>
        </div>
      </div>
    );
  }

  const isWin = battleResult?.winner.id === player?.id;
  const displayReport = streamingReport;
  const opponentName = opponent?.name ?? '神秘对手';

  return (
    <BattlePageLayout
      title={`【赌战战报 · ${!player ? '加载中' : `${player?.name} vs ${opponentName}`}】`}
      backHref="/game/bet-battle"
      backLabel="返回赌战台"
      error={error}
      loading={loading}
      battleResult={battleResult}
      isStreaming={isStreaming}
      actions={{
        primary: {
          label: '返回赌战台',
          onClick: () => router.push('/game/bet-battle'),
        },
      }}
    >
      {battleResult?.timeline &&
        battleResult.timeline.length > 0 &&
        opponent &&
        player &&
        (isStreaming || battleEnd) && (
          <BattleTimelineViewer battleResult={battleResult} />
        )}

      <BattleReportViewer
        displayReport={displayReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={isWin}
      />

      {settlement && !isStreaming && (
        <p
          className={`mb-6 text-center text-sm ${
            settlement.isWin ? 'text-crimson' : 'text-ink-secondary'
          }`}
        >
          {settlement.resultMessage}
        </p>
      )}
    </BattlePageLayout>
  );
}

export default function BetBattleChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-ink">加载中...</p>
          </div>
        </div>
      }
    >
      <BetBattleChallengePageContent />
    </Suspense>
  );
}
