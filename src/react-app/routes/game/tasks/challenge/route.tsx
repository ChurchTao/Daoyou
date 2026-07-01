import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { startTaskChallengeOnce } from '@app/lib/tasks/taskClient';
import type { TaskChallengeResponse } from '@shared/contracts/task';
import type { BattleRecord } from '@shared/types/battle';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

function TaskChallengePageContent() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [challengeTitle, setChallengeTitle] = useState('破境试炼');
  const [isWin, setIsWin] = useState(false);
  const playback = useBattlePlaybackState(battleResult);

  useEffect(() => {
    let cancelled = false;

    const runChallenge = async () => {
      if (!taskId) {
        setError('缺少任务标识');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);
      setBattleResult(undefined);

      try {
        const payload = (await startTaskChallengeOnce(
          taskId,
        )) as TaskChallengeResponse;
        if (cancelled) {
          return;
        }

        setBattleResult(payload.data.battleResult);
        setChallengeTitle(payload.data.challengeTitle);
        setIsWin(payload.data.isWin);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : '试炼挑战失败，请稍后再试',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void runChallenge();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="mb-4 text-crimson">{error}</p>
          <InkButton onClick={() => navigate('/game/tasks')}>
            返回任务中心
          </InkButton>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={challengeTitle}
      subtitle="以斗法验道心，以胜负问前路。"
      variant="immersive-battle"
      loading={loading}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`task-challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`task-challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && playback.isPlaybackFinished}
        title={isWin ? '试炼已过' : '试炼未过'}
        confirmLabel="返回任务中心"
        cancelLabel="回静室"
        onConfirm={() => navigate('/game/tasks')}
        onCancel={() => navigate('/game/retreat')}
        content={
          <div className="space-y-1 leading-8">
            <p>
              {isWin
                ? '这一关已经跨过去了。回任务中心或静室，继续推进你的破境。'
                : '这一战还没压过去。稳住气息，再做准备后重来。'}
            </p>
          </div>
        }
      />
    </BattlePageLayout>
  );
}

export default function TaskChallengePage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="试炼战报推演中……" />}>
      <TaskChallengePageContent />
    </Suspense>
  );
}
