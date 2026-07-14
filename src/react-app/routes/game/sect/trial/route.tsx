import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { startSectTrialOnce } from '@app/lib/sect/sectClient';
import { sectRegistry } from '@shared/engine/sect';
import type { BattleRecord } from '@shared/types/battle';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

function SectTrialPageContent() {
  const navigate = useNavigate();
  const { sectId = '' } = useParams();
  const definition = sectRegistry.get(sectId)?.definition;
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const playback = useBattlePlaybackState(battleResult);
  const isWin = battleResult?.winner.id === battleResult?.player;

  useEffect(() => {
    let cancelled = false;

    const runTrial = async () => {
      setLoading(true);
      setError(undefined);

      try {
        if (!definition) throw new Error('未知宗门');
        const result = await startSectTrialOnce(definition.id);
        if (!cancelled) {
          setBattleResult(result.battle);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : '山门试炼推演失败',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void runTrial();
    return () => {
      cancelled = true;
    };
  }, [definition]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong max-w-md border border-dashed bg-[rgba(248,243,230,0.92)] px-5 py-5 text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => navigate('/game/sect')}>返回山门</InkButton>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={`${definition?.name ?? '宗门'} · ${definition?.trial.name ?? '入门试炼'}`}
      subtitle={definition?.trial.description ?? '完成宗门试炼后即可返回山门。'}
      variant="immersive-battle"
      loading={loading}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel
        battleResult={battleResult}
        playback={playback}
        statusAction={{
          label: '返回山门',
          onClick: () => navigate('/game/sect'),
        }}
      />

      <CombatResultDialog
        key={`sect-trial-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`sect-trial-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && playback.isPlaybackFinished}
        title={
          isWin
            ? `${definition?.trial.name ?? '试炼'}得胜`
            : `${definition?.trial.name ?? '试炼'}完成`
        }
        confirmLabel="返回山门"
        cancelLabel="重看战局"
        onConfirm={() => navigate('/game/sect')}
        onCancel={playback.reset}
        content={
          <p className="leading-8">
            {isWin
              ? `${definition?.name ?? '宗门'}执事已为你记下这场胜绩。`
              : `胜负不论，${definition?.name ?? '宗门'}执事已确认你完成入门体验，可以回山门拜师。`}
          </p>
        }
      />
    </BattlePageLayout>
  );
}

export default function SectTrialPage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="山门战局推演中……" />}>
      <SectTrialPageContent />
    </Suspense>
  );
}
