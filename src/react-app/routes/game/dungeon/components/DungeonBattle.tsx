import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { useBattle } from '@app/lib/hooks/dungeon/useBattle';
import type { ResourceOperation } from '@shared/engine/resource/types';
import type { Cultivator } from '@shared/types/cultivator';
import { useEffect, useRef, useState } from 'react';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@shared/lib/dungeon/types';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}

interface DungeonBattleProps {
  battleId: string;
  player: Cultivator;
  onBattleComplete: (data: BattleCallbackData | null) => void;
}

/**
 * 副本战斗组件
 * 处理战斗执行和展示
 */
export function DungeonBattle({
  battleId,
  player,
  onBattleComplete,
}: DungeonBattleProps) {
  const { battleResult, loading, executeBattle } = useBattle();
  const playback = useBattlePlaybackState(battleResult);
  const [battleSettlement, setBattleSettlement] =
    useState<BattleCallbackData | null>(null);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const runBattle = async () => {
      const result = await executeBattle(battleId);
      if (result?.callbackData) {
        setBattleSettlement(result.callbackData);
      } else if (!result?.battleResult) {
        onBattleComplete(null);
      }
    };

    void runBattle();
  }, [battleId, executeBattle, onBattleComplete]);

  const isPlaybackFinished = playback.isPlaybackFinished;

  return (
    <BattlePageLayout
      title="副本战斗"
      subtitle="查看双方状态、技能变化和实时战斗日志。"
      variant="immersive-battle"
      loading={loading && !battleResult}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`dungeon-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`dungeon-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && isPlaybackFinished}
        title={battleResult?.winner.id === player.id ? '战斗胜利' : '战斗失败'}
        confirmLabel={battleSettlement?.isFinished ? '查看结算' : '继续探险'}
        onConfirm={() => {
          if (battleSettlement) {
            onBattleComplete(battleSettlement);
            return;
          }

          if (battleResult) {
            onBattleComplete(null);
          }
        }}
        content={
          <p className="leading-8">
            {battleResult?.winner.id === player.id
              ? '你已经击败当前敌人，可以继续推进副本。'
              : '你在这场战斗中落败，本轮探索到此结束。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
