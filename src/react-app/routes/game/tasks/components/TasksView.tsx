import { StoryVolumeCard } from '@app/components/feature/story/StoryVolumeCard';
import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import { TutorialTaskCard } from '@app/components/feature/tasks/TutorialTaskCard';
import {
  GameLoadingState,
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkNotice } from '@app/components/ui';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { usePlayerSession } from '@app/lib/resources/player';
import { findNextTutorialTask } from '@app/lib/tasks/taskClient';

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
  const nextTutorialTask = tasks ? findNextTutorialTask(tasks) : null;

  return (
    <GameSceneFrame
      title="任务中心"
      description="主线卷宗只用于回顾与中断后的续接；主线本身会在宗门、坊市、副本与修行等真实场景中自动发生。入门与破境卷宗仍按原系统独立处理。"
    >
      <GameSceneSection title="主线卷宗 · 回顾">
        <StoryVolumeCard />
      </GameSceneSection>

      <GameSceneSection title="入门卷宗">
        {loading || !tasks ? (
          <GameLoadingState message="正在整理入门卷宗……" variant="inline" />
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
              <p className="text-ink-secondary text-sm leading-7">
                入门卷宗已办妥。之后可按破境卷宗、宗门执事堂与洞府状态推进。
              </p>
            ) : null}
          </div>
        )}
      </GameSceneSection>

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
