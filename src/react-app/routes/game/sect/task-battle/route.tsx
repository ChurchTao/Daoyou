import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { startSectTaskBattleOnce } from '@app/lib/sect/sectClient';
import type { SectBattleOutcomeData } from '@shared/contracts/sect';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

export default function SectTaskBattlePage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [result, setResult] = useState<SectBattleOutcomeData>();
  const [error, setError] = useState<string>();
  const parameterError = !taskId || !attemptId ? '缺少宗门战斗标识' : undefined;
  const playback = useBattlePlaybackState(result?.battle);

  useEffect(() => {
    let cancelled = false;
    if (!taskId || !attemptId) return;
    void startSectTaskBattleOnce(taskId, attemptId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '宗门战局推演失败');
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, taskId]);

  if (error || parameterError)
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="mb-4 text-crimson">{error ?? parameterError}</p>
          <InkButton onClick={() => navigate('/game/sect/affairs')}>
            返回执事堂
          </InkButton>
        </div>
      </div>
    );

  if (!result) return <GameImmersiveLoading message="宗门战局推演中……" />;

  const retry = () =>
    navigate(
      `/game/sect/tasks/${encodeURIComponent(taskId!)}/battle?attemptId=${crypto.randomUUID()}`,
      { replace: true },
    );

  return (
    <BattlePageLayout
      title={result.challengeTitle}
      subtitle="执事封签已启，胜负与战功皆以此局为准。"
      variant="immersive-battle"
      battleResult={result.battle}
    >
      <BattlePlaybackPanel
        battleResult={result.battle}
        playback={playback}
        statusAction={{
          label: '返回执事堂',
          onClick: () => navigate('/game/sect/affairs'),
        }}
      />
      <CombatResultDialog
        key={`${attemptId}-${result.battle.turns}`}
        dialogKey={`sect-task-${attemptId}`}
        open={playback.isPlaybackFinished}
        title={result.won ? '宗门战局得胜' : '宗门战局失利'}
        confirmLabel="返回执事堂"
        cancelLabel={result.won ? '重看战局' : '重新挑战'}
        onConfirm={() => navigate('/game/sect/affairs')}
        onCancel={result.won ? playback.reset : retry}
        content={
          <p className="leading-8">
            {result.won
              ? result.rewardGranted
                ? '执事已将胜绩与贡献记入宗门卷宗。'
                : '胜绩已经记入宗门卷宗。'
              : '此战未能压过残影，任务仍然保留，可整顿后再次挑战。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
