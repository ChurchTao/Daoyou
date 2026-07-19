import { SectTaskActionRenderer } from '@app/components/feature/sect/SectTaskActionRenderer';
import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkCard, InkNotice } from '@app/components/ui';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import type {
  SectTaskActionData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import { useCallback, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router';
import {
  postJson,
  SectPageLoading,
  SectQueryError,
  SectScene,
  useSectMutation,
} from '../components/SectScene';
import { SweepGameOverlay } from './SweepGameOverlay';

type TaskAction = SectTaskViewData['actions'][number];

export default function SectAffairsPage() {
  const navigate = useNavigate();
  const [sweepTask, setSweepTask] = useState<SectTaskViewData>();
  const { data: tasks, error, reload, retry } = useSectResourceQuery('tasks', fetchSectTasks);
  const { busy, run } = useSectMutation(reload);

  const execute = useCallback(
    (
      task: SectTaskViewData,
      action: TaskAction,
      input: Record<string, unknown>,
      message: string,
    ) =>
      run<SectTaskActionData>(
        `/api/sects/current/tasks/${encodeURIComponent(task.definitionId)}/actions/${encodeURIComponent(action.key)}`,
        postJson({ input }),
        message,
      ),
    [run],
  );

  const startBattle = useCallback(
    (task: SectTaskViewData) =>
      navigate(
        `/game/sect/tasks/${encodeURIComponent(task.definitionId)}/battle?attemptId=${crypto.randomUUID()}`,
      ),
    [navigate],
  );

  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!tasks) return <SectPageLoading message="执事正整理今日委托……" />;

  const rendererProps = {
    busy,
    execute,
    startBattle,
    startSweep: setSweepTask,
  };

  return (
    <SectScene
      title="执事堂"
      description="木榜上新令墨迹未干，今日差事、周录与晋升试炼各有封签；择下一令，便不可在当日更换。"
      mood="affairs"
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>今日：{tasks.dateKey}</p>
          <p>本周：{tasks.weekKey}</p>
        </div>
      }
    >
      <TaskSection title="今日委托" tasks={tasks.sections.daily} rendererProps={rendererProps} />
      <TaskSection title="本周宗门录" tasks={tasks.sections.weekly} rendererProps={rendererProps} />
      <TaskSection title="晋升试炼" tasks={tasks.sections.promotion} rendererProps={rendererProps} />
      {sweepTask ? (
        <SweepGameOverlay
          task={sweepTask}
          close={() => setSweepTask(undefined)}
          onCompleted={reload}
          run={run}
        />
      ) : null}
    </SectScene>
  );
}

function TaskSection({
  title,
  tasks,
  rendererProps,
}: {
  title: string;
  tasks: SectTaskViewData[];
  rendererProps: Omit<
    ComponentProps<typeof SectTaskActionRenderer>,
    'task' | 'action'
  >;
}) {
  return (
    <section className="border-y border-stone-800/10 py-5 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard key={`${task.periodKey}:${task.definitionId}`} task={task} rendererProps={rendererProps} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  rendererProps,
}: {
  task: SectTaskViewData;
  rendererProps: Omit<
    ComponentProps<typeof SectTaskActionRenderer>,
    'task' | 'action'
  >;
}) {
  return (
    <InkCard highlighted={task.state === 'active' || task.state === 'completed'}>
      <div className="flex items-start justify-between gap-3">
        <strong>{task.presentation.title}</strong>
        <span className="text-crimson text-sm">{task.presentation.rewardSummary}</span>
      </div>
      <p className="text-ink-secondary mt-2 text-sm leading-6">
        {task.presentation.description}
      </p>
      {task.kind !== 'daily' || task.progress.target > 1 ? (
        <p className="mt-2 text-sm">
          进度 {task.progress.current} / {task.progress.target}
        </p>
      ) : null}
      {task.state === 'completed' ? (
        <InkNotice className="mt-3">本期已经完成</InkNotice>
      ) : task.actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.actions.map((action) => (
            <SectTaskActionRenderer
              key={action.key}
              task={task}
              action={action}
              {...rendererProps}
            />
          ))}
        </div>
      ) : (
        <p className="text-ink-secondary mt-3 text-sm">进度会随宗门勤务自动更新。</p>
      )}
    </InkCard>
  );
}
