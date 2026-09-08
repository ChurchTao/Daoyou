import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui';
import {
  playerConditionResource,
  playerTasksResource,
  playerTaskSummaryResource,
} from '@app/lib/resources/definitions';
import { useResource, useSingletonResource } from '@app/lib/resources/hooks';
import { startTaskChallengeOnce } from '@app/lib/tasks/taskClient';
import type { BreakthroughSessionView } from '@shared/contracts/combatV6Breakthrough';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function TaskChallengePage() {
  const { taskId } = useParams();
  return <TaskChallenge key={taskId} taskId={taskId} />;
}
function TaskChallenge({ taskId }: { taskId?: string }) {
  const combat = useCombatV6Session<BreakthroughSessionView>(
    `/api/combat-v6/breakthrough/tasks/${taskId}`,
    !!taskId,
  );
  const { invalidate: invalidateTasks } = useResource(playerTasksResource, {});
  const { invalidate: invalidateSummary } = useSingletonResource(
    playerTaskSummaryResource,
  );
  const { invalidate: invalidateCondition } = useSingletonResource(
    playerConditionResource,
  );
  const navigate = useNavigate();
  const { session } = combat;
  const sessionId = session?.sessionId;
  const settlement = session?.settlement;
  useEffect(() => {
    if (sessionId) invalidateCondition();
    if (settlement === 'settled') {
      invalidateTasks();
      invalidateSummary();
    }
  }, [
    sessionId,
    settlement,
    invalidateTasks,
    invalidateSummary,
    invalidateCondition,
  ]);
  const start = () =>
    combat.run(async () => {
      if (!taskId) throw new Error('缺少任务标识');
      combat.acceptSession((await startTaskChallengeOnce(taskId)).data);
    });
  const title = session?.challengeTitle ?? '破境试炼';
  return (
    <CombatV6Page
      title={title}
      active={!!session}
      loading={!!taskId && combat.loading}
      error={combat.error || (!taskId ? '缺少任务标识' : undefined)}
      onRetry={() => void combat.refresh(true)}
      back="/game/tasks"
      backLabel="返回任务中心"
    >
      {session?.settlement === 'pending' ? (
        <InkButton
          pending={combat.pending}
          onClick={() => void combat.resolve()}
        >
          重试结算
        </InkButton>
      ) : null}
      {session ? (
        <CombatV6Battle
          allowAbandon={false}
          title={title}
          session={session}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={() => {
            if (session.settlement === 'settled' && !combat.playing)
              navigate('/game/tasks', { replace: true });
          }}
          back="/game/tasks"
          backLabel="返回任务中心"
        />
      ) : taskId && !combat.error ? (
        <InkButton pending={combat.pending} onClick={() => void start()}>
          开始试炼
        </InkButton>
      ) : null}
      {session?.settlement === 'settled' &&
      session.outcome !== 'victory' &&
      !combat.playing ? (
        <InkButton pending={combat.pending} onClick={() => void start()}>
          重新挑战
        </InkButton>
      ) : null}
    </CombatV6Page>
  );
}
