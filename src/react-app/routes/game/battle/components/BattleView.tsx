import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { useBattleViewModel } from '../hooks/useBattleViewModel';

/**
 * 战斗主视图组件
 */
export function BattleView() {
  const {
    player,
    opponent,
    battleResult,
    loading,
    battleEnd,
    isWin,
    opponentName,
    handleBattleAgain,
  } = useBattleViewModel();
  const playback = useBattlePlaybackState(battleResult);

  if (!player || !opponent) {
    return <GameImmersiveLoading message="战局演算中……" />;
  }

  return (
    <BattlePageLayout
      title={`战斗 · ${player.name} vs ${opponentName}`}
      subtitle="实时查看血量、技能状态和战斗日志。"
      loading={loading}
      battleResult={battleResult}
      actions={{
        primary: {
          label: '返回主界',
          href: '/game',
        },
        secondary: [
          {
            label: '再战',
            onClick: handleBattleAgain,
          },
        ],
      }}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`battle-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`battle-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && battleEnd && playback.isPlaybackFinished}
        title={isWin ? '战斗胜利' : '战斗失败'}
        content={
          <p className="leading-8">
            {isWin
              ? `「${player.name}」在第 ${battleResult?.turns} 回合击败了对手。`
              : `「${player.name}」在第 ${battleResult?.turns} 回合力竭倒下。`}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
