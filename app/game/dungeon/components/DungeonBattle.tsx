import { BattlePageLayout } from '@/components/BattlePageLayout';
import { BattleReportViewer } from '@/components/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/BattleTimelineViewer';
import { BattleEngineResult } from '@/engine/battle';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@/lib/dungeon/types';
import { useBattle } from '@/lib/hooks/dungeon/useBattle';
import { Cultivator } from '@/types/cultivator';
import { useEffect, useRef, useState } from 'react';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}

interface DungeonBattleProps {
  battleId: string;
  opponentName: string;
  playerName: string;
  player: Cultivator;
  onBattleComplete: (data: BattleCallbackData | null) => void;
}

/**
 * 副本战斗组件
 * 处理战斗执行和展示
 */
export function DungeonBattle({
  battleId,
  opponentName,
  playerName,
  player,
  onBattleComplete,
}: DungeonBattleProps) {
  const {
    battleResult,
    streamingReport,
    isStreaming,
    battleEnd,
    executeBattle,
  } = useBattle();
  const [battleSettlement, setBattleSettlement] =
    useState<BattleCallbackData | null>(null);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const runBattle = async () => {
      const result = await executeBattle(battleId);
      if (result?.callbackData) {
        if (result.callbackData.isFinished) {
          setBattleSettlement({
            isFinished: true,
            settlement: result.callbackData.settlement,
          });
        } else {
          setBattleSettlement(result.callbackData);
        }
      }
    };

    runBattle();
  }, [battleId, executeBattle, onBattleComplete]);

  return (
    <BattlePageLayout
      title={`【激战 · 副本探索】`}
      backHref="#"
      loading={!battleResult && isStreaming}
      battleResult={battleResult}
      isStreaming={isStreaming}
      actions={{
        primary: {
          label: battleSettlement
            ? '查看结算'
            : battleEnd
              ? '继续探险'
              : '战斗中...',
          onClick: () => {
            if (battleSettlement) {
              onBattleComplete(battleSettlement);
            } else if (battleEnd) {
              onBattleComplete(null);
            }
          },
          disabled: !battleEnd && !battleSettlement,
        },
      }}
    >
      {/* Timeline */}
      {battleResult?.timeline && battleResult.timeline.length > 0 && (
        <BattleTimelineViewer
          battleResult={battleResult as BattleEngineResult}
          playerName={playerName}
          opponentName={opponentName}
        />
      )}

      {/* Report */}
      <BattleReportViewer
        displayReport={streamingReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={battleResult?.winner.id === player?.id}
      />
    </BattlePageLayout>
  );
}
