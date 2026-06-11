import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useTowerBattle } from '@app/lib/hooks/tower/useTowerBattle';
import { useTowerBattleContext } from '@app/lib/hooks/tower/useTowerBattleContext';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { describeEncounterLabel, formatDepthLabel } from '../utils';

export default function TowerBattlePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const battleId = searchParams.get('battleId');
  const { cultivator } = useCultivator();
  const { context, error: contextError, loading: contextLoading } =
    useTowerBattleContext(battleId);
  const { battleResult, loading: battleLoading, executeBattle } = useTowerBattle();
  const playback = useBattlePlaybackState(battleResult);
  const [error, setError] = useState<string>();
  const hasExecutedRef = useRef(false);
  const [hasBattleCallback, setHasBattleCallback] = useState(false);

  useEffect(() => {
    if (!battleId || hasExecutedRef.current) {
      return;
    }

    hasExecutedRef.current = true;

    const runBattle = async () => {
      const result = await executeBattle(battleId);
      if (!result?.callbackData) {
        setError('幻境战局异常中断');
        return;
      }

      setHasBattleCallback(true);
    };

    void runBattle();
  }, [battleId, executeBattle]);

  if (!battleId) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="text-crimson mb-4">缺少幻境战局标识。</p>
          <InkButton href="/game/tower" variant="primary">
            返回幻境
          </InkButton>
        </div>
      </div>
    );
  }

  if (contextLoading && !context) {
    return <GameImmersiveLoading message="幻影战局凝形中……" />;
  }

  const pageError = error ?? contextError;

  return (
    <BattlePageLayout
      title={
        context
          ? `${context.enemy.title ? `${context.enemy.title} · ` : ''}${context.enemy.name}`
          : '蜃楼幻境战局'
      }
      subtitle={
        context
          ? `${formatDepthLabel(context.encounter.floor)} · ${describeEncounterLabel(context.encounter.kind)} · ${context.encounter.realm} ${context.encounter.realmStage}`
          : '幻影正在显形。'
      }
      variant="immersive-battle"
      error={pageError}
      loading={battleLoading && !battleResult}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`tower-route-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`tower-route-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && playback.isPlaybackFinished && hasBattleCallback}
        title={battleResult?.winner.id === cultivator?.id ? '战局得胜' : '战局失利'}
        confirmLabel="返回幻境"
        onConfirm={() => navigate('/game/tower')}
        content={
          <p className="leading-8">
            {battleResult?.winner.id === cultivator?.id
              ? '这一重幻影已散，回返蜃楼承接后续机缘。'
              : '你在此处败退，本周这一回幻境也在此收束。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
