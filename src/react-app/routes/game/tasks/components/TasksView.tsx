import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import { DailyTaskCard } from '@app/components/feature/tasks/DailyTaskCard';
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

  const dailyTasks = tasks
    .filter((task) => task.category === 'daily')
    .sort((left, right) => {
      if (left.status === right.status) {
        return left.createdAt.localeCompare(right.createdAt);
      }

      return left.status === 'active' ? -1 : 1;
    });
  const activeBreakthroughTasks = tasks.filter(
    (task) => task.category === 'breakthrough_major' && task.status === 'active',
  );
  const nextTutorialTask = findNextTutorialTask(tasks);

  return (
    <GameSceneFrame
      title="任务中心"
      description="今日日常与破境卷宗都归在此处。先把手头差事理顺，再看是否该回静室叩关。"
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
                入门卷宗已办妥。之后按今日日常、破境卷宗与洞府状态推进即可。
              </p>
            ) : null}
          </div>
        )}
      </GameSceneSection>

      <GameSceneSection title="今日日常">
        {loading ? (
          <p className="text-sm text-ink-secondary">正在整理今日差事……</p>
        ) : error ? (
          <InkNotice>{error}</InkNotice>
        ) : dailyTasks.length === 0 ? (
          <p className="text-sm leading-7 text-ink-secondary">
            今日差事尚未排定，稍后再来翻卷即可。
          </p>
        ) : (
          <div className="space-y-4">
            {dailyTasks.map((task) => (
              <DailyTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </GameSceneSection>

      {!loading && !error ? (
        <GameSceneSection title="破境卷宗">
          {activeBreakthroughTasks.length === 0 ? (
            <p className="text-sm leading-7 text-ink-secondary">
              眼前没有待办的破境卷宗。若已临大境界圆满，回静室或稍后刷新即可整理新卷。
            </p>
          ) : (
            <div className="space-y-4">
              {activeBreakthroughTasks.map((task) => (
                <BreakthroughTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </GameSceneSection>
      ) : null}
    </GameSceneFrame>
  );
}
