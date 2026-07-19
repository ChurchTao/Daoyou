import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import { TutorialTaskCard } from '@app/components/feature/tasks/TutorialTaskCard';
import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { InkNotice } from '@app/components/ui';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { findNextTutorialTask } from '@app/lib/tasks/taskClient';

export function TasksView() {
  const { cultivator, isLoading } = usePlayerStateView();
  const { tasks, loading, error } = useTaskList(cultivator?.id);

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">卷宗尚在归档……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>当前没有活跃角色，无法查看任务。</InkNotice>
      </div>
    );
  }

  const breakthroughTasks = tasks.filter(
    (task) => task.category === 'breakthrough_major',
  );
  const nextTutorialTask = findNextTutorialTask(tasks);

  return (
    <GameSceneFrame
      title="任务中心"
      description="入门引导与破境卷宗归在此处。宗门勤务已经移交执事堂，不再与通用任务混列。"
    >
      <GameSceneSection title="入门卷宗">
        {loading ? (
          <p className="text-sm text-ink-secondary">正在整理入门卷宗……</p>
        ) : error ? (
          <InkNotice>{error}</InkNotice>
        ) : (
          <div className="space-y-4">
            {nextTutorialTask ? (
              <TutorialTaskCard
                key={nextTutorialTask.id}
                task={nextTutorialTask}
              />
            ) : null}
            {!nextTutorialTask ? (
              <p className="text-sm leading-7 text-ink-secondary">
                入门卷宗已办妥。之后可按破境卷宗、宗门执事堂与洞府状态推进。
              </p>
            ) : null}
          </div>
        )}
      </GameSceneSection>

      {!loading && !error ? (
        <GameSceneSection title="破境卷宗">
          {breakthroughTasks.length === 0 ? (
            <p className="text-sm leading-7 text-ink-secondary">
              眼前没有待办的破境卷宗。若已临大境界圆满，回静室或稍后刷新即可整理新卷。
            </p>
          ) : (
            <div className="space-y-4">
              {breakthroughTasks.map((task) => (
                <BreakthroughTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </GameSceneSection>
      ) : null}
    </GameSceneFrame>
  );
}
