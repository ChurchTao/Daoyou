import { SectTaskActionRenderer } from '@app/components/feature/sect/SectTaskActionRenderer';
import { SectTaskInteractionProvider } from '@app/components/feature/sect/SectTaskInteractionProvider';
import { SectTaskOutcomeHost } from '@app/components/feature/sect/SectTaskOutcomeHost';
import { useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkCard, InkNotice } from '@app/components/ui';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import type { SectTaskViewData } from '@shared/contracts/sect';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectQueryError,
  SectScene,
} from '../components/SectScene';

export default function SectAffairsPage() {
  return (
    <SectPermissionBoundary permission="sect.tasks.use" title="执事堂">
      <SectAffairsBody />
    </SectPermissionBoundary>
  );
}

function SectAffairsBody() {
  const { data: tasks, error, reload, retry } = useSectResourceQuery('tasks', fetchSectTasks);

  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!tasks) return <SectPageLoading message="执事正整理今日委托……" />;

  return (
    <SectTaskInteractionProvider refreshTasks={reload}>
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
        <TaskSection title="今日委托" tasks={tasks.sections.daily} />
        <TaskSection title="本周宗门录" tasks={tasks.sections.weekly} />
        <TaskSection title="晋升试炼" tasks={tasks.sections.promotion} />
        <SectTaskOutcomeHost />
      </SectScene>
    </SectTaskInteractionProvider>
  );
}

function TaskSection({
  title,
  tasks,
}: {
  title: string;
  tasks: SectTaskViewData[];
}) {
  return (
    <section className="border-y border-stone-800/10 py-5 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard key={`${task.periodKey}:${task.definitionId}`} task={task} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
}: {
  task: SectTaskViewData;
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
            />
          ))}
        </div>
      ) : (
        <p className="text-ink-secondary mt-3 text-sm">进度会随宗门勤务自动更新。</p>
      )}
    </InkCard>
  );
}
