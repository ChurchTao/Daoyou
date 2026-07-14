import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { startLingxiaoExperienceOnce } from '@app/lib/sect/sectClient';
import type { BattleRecord } from '@shared/types/battle';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

function LingxiaoTrialPageContent() {
  const navigate = useNavigate();
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
        const result = await startLingxiaoExperienceOnce();
        if (!cancelled) {
          setBattleResult(result.battle);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '山门试剑推演失败');
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
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="mb-4 text-crimson">{error}</p>
          <InkButton onClick={() => navigate('/game/sect')}>返回山门</InkButton>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title="凌霄剑宗 · 山门试剑"
      subtitle="借木剑习基础剑式，胜负皆记作完成。"
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
        title={isWin ? '试剑得胜' : '试剑完成'}
        confirmLabel="返回山门"
        cancelLabel="重看战局"
        onConfirm={() => navigate('/game/sect')}
        onCancel={playback.reset}
        content={
          <p className="leading-8">
            {isWin
              ? '木人剑势已破，执事为你记下了这场试剑。'
              : '胜负不论，执事已确认你完成基础剑术体验，可以回山门拜师。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}

export default function LingxiaoTrialPage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="山门战局推演中……" />}>
      <LingxiaoTrialPageContent />
    </Suspense>
  );
}
