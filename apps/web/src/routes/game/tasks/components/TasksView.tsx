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
    return <GameSceneLoading message="正在查看破境任务……" />;
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
      description="查看破境任务和试炼进度。宗门任务请到宗门事务中查看。"
    >
      {loading || !tasks ? (
        <GameSceneLoading message="正在查看破境任务……" />
      ) : error ? (
        <InkNotice>{error}</InkNotice>
      ) : null}

      {!loading && !error && breakthroughTasks ? (
        <GameSceneSection title="破境卷宗">
          {breakthroughTasks.length === 0 ? (
            <p className="text-ink-secondary text-sm leading-7">
              暂无破境任务。若境界已圆满，可回静室查看，或稍后刷新。
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
