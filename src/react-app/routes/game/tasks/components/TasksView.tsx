import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkNotice } from '@app/components/ui';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { usePlayerSession } from '@app/lib/resources/player';

export function TasksView() {
  const session = usePlayerSession();
  const cultivator = session.data?.activeCultivator;
  const isLoading = session.loading;
  const { tasks, loading, error } = useTaskList(cultivator?.id);

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="卷宗尚在归档……" />;
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>当前没有活跃角色，无法查看任务。</InkNotice>
      </div>
    );
  }

  const breakthroughTasks = tasks?.filter(
    (task) => task.category === 'breakthrough_major',
  );

  return (
    <GameSceneFrame
      title="任务中心"
      description="破境卷宗归在此处。宗门勤务已经移交执事堂。"
    >
      {loading || !tasks ? (
        <GameSceneLoading message="正在整理卷宗……" />
      ) : error ? (
        <InkNotice>{error}</InkNotice>
      ) : null}

      {!loading && !error && breakthroughTasks ? (
        <GameSceneSection title="破境卷宗">
          {breakthroughTasks.length === 0 ? (
            <p className="text-ink-secondary text-sm leading-7">
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
