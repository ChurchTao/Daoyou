import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import { getNextMajorRealm } from '@daoyou/game-rules/consumables/breakthrough';

export function TasksView() {
  const session = usePlayerSession();
  const profile = useCultivatorIdentity();
  const cultivator = session.data?.activeCultivator;
  const isLoading = session.loading;
  const { tasks, loading, error, reload } = useTaskList(cultivator?.id);

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
      description="境界圆满后，破境卷宗会自动送达。依次备妥、渡关，再回静室冲关。"
    >
      <div className="flex justify-end">
        <InkButton
          onClick={() => void reload()}
          pending={loading}
          pendingLabel="核对中……"
        >
          核对进度
        </InkButton>
      </div>
      {error ? (
        <InkNotice>{error}，可点击「核对进度」重试。</InkNotice>
      ) : loading || !tasks ? (
        <GameSceneLoading message="正在查看破境任务……" />
      ) : null}

      {!loading && !error && breakthroughTasks ? (
        <GameSceneSection title="破境卷宗">
          {breakthroughTasks.length === 0 ? (
            <p className="text-ink-secondary text-sm leading-7">
              {profile.data?.cultivator &&
              !getNextMajorRealm(profile.data.cultivator.realm)
                ? '已至当前道途之巅，无需再领取破境卷宗。'
                : profile.data?.cultivator?.realm_stage === '圆满'
                  ? '卷宗尚未送达，请点击「核对进度」重新领取。'
                  : '当前境界尚未圆满。继续修行至圆满，便会自动收到下一境的破境卷宗。'}
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
