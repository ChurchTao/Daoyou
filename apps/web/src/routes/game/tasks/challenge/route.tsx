import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { InkButton } from '@app/components/ui';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import {
  playerConditionResource,
  playerTasksResource,
  playerTaskSummaryResource,
} from '@app/lib/resources/definitions';
import { useResource, useSingletonResource } from '@app/lib/resources/hooks';
import { usePlayerSession } from '@app/lib/resources/player';
import { startTaskChallengeOnce } from '@app/lib/tasks/taskClient';
import type { BreakthroughSessionView } from '@daoyou/contracts/combat/breakthrough';
import { BREAKTHROUGH_CHALLENGES } from '@daoyou/game-content/combat/breakthrough';
import {
  BREAKTHROUGH_PERFORMANCES,
  getBreakthroughPreparationHint,
} from '@daoyou/game-content/performance/breakthrough';
import type { BreakthroughChallengeId } from '@daoyou/game-domain/combat/challenges';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function TaskChallengePage() {
  const { taskId } = useParams();
  return <TaskChallenge key={taskId} taskId={taskId} />;
}
function TaskChallenge({ taskId }: { taskId?: string }) {
  const player = usePlayerSession();
  const {
    tasks,
    loading: tasksLoading,
    error: taskError,
    reload,
  } = useTaskList(player.data?.activeCultivator?.id);
  const [retryPrelude, setRetryPrelude] = useState(false);
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
      let next: BreakthroughSessionView;
      try {
        next = (await startTaskChallengeOnce(taskId)).data;
      } catch (error) {
        const recovered = await combatV6Request<BreakthroughSessionView | null>(
          `/api/combat-v6/breakthrough/tasks/${taskId}/sessions/current`,
        ).catch(() => null);
        if (!recovered || recovered.settlement === 'settled') throw error;
        next = recovered;
      }
      combat.acceptSession(next);
      setRetryPrelude(false);
    });
  const task = tasks?.find((item) => item.id === taskId);
  const stage = task?.snapshot.stages.find((item) => item.current);
  const challengeId =
    stage?.challengeId &&
    Object.hasOwn(BREAKTHROUGH_PERFORMANCES, stage.challengeId)
      ? (stage.challengeId as BreakthroughChallengeId)
      : null;
  const script = challengeId ? BREAKTHROUGH_PERFORMANCES[challengeId] : null;
  if (!combat.loading && (!session || retryPrelude) && script && challengeId) {
    return (
      <PerformancePlayer
        key={`${taskId}:${challengeId}:${retryPrelude}`}
        script={script}
        context={{}}
        pictureFit="contain"
        finalLabel={`迎战${BREAKTHROUGH_CHALLENGES[challengeId].name}`}
        finishHint={`${getBreakthroughPreparationHint(challengeId)} 确认迎战后才会进入战斗。`}
        finishPendingLabel="凝神迎战中……"
        busy={combat.pending}
        error={combat.error}
        onFinish={() => void start()}
        onExit={() => navigate('/game/tasks')}
      />
    );
  }
  const title = session?.challengeTitle ?? '破境试炼';
  return (
    <CombatV6Page
      title={title}
      active={!!session && !retryPrelude}
      loading={!!taskId && (combat.loading || (!session && tasksLoading))}
      error={
        combat.error || taskError || (!taskId ? '缺少任务标识' : undefined)
      }
      onRetry={() => {
        void combat.refresh(true);
        void reload();
      }}
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
      {session && !retryPrelude ? (
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
          endAction={
            session.settlement === 'settled' &&
            session.outcome !== 'victory' ? (
              <InkButton
                pending={combat.pending}
                onClick={() => setRetryPrelude(true)}
              >
                重新凝神
              </InkButton>
            ) : undefined
          }
          back="/game/tasks"
          backLabel="返回任务中心"
        />
      ) : taskId && !combat.error && !tasksLoading ? (
        <div className="space-y-4 text-sm leading-7">
          <p>
            {task?.status === 'completed'
              ? '破境准备已齐，可回静室正式冲关。'
              : task
                ? (stage?.description ?? '请先完成当前破境准备。')
                : '没有找到这份破境卷宗，请返回任务中心重新查看。'}
          </p>
          {stage?.objectives
            .filter((objective) => !objective.completed)
            .map((objective) => (
              <p key={objective.id}>
                {objective.title} · {objective.progressText}
              </p>
            ))}
          <InkButton
            href={
              task?.status === 'completed' ? '/game/retreat' : '/game/tasks'
            }
          >
            {task?.status === 'completed' ? '回静室冲关' : '查看准备'}
          </InkButton>
        </div>
      ) : null}
    </CombatV6Page>
  );
}
