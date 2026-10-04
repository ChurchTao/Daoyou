import {
  playerTasksResource,
  type PlayerTasksParams,
} from '@app/lib/resources/definitions';
import { useResource } from '@app/lib/resources/hooks';
import type { TaskStatus } from '@daoyou/game-domain/tasks';
import { useMemo } from 'react';

export function useTaskList(
  cultivatorId: string | undefined,
  status?: TaskStatus,
) {
  const params = useMemo<PlayerTasksParams>(
    () => ({ status }),
    [status],
  );
  const query = useResource(
    playerTasksResource,
    params,
    Boolean(cultivatorId),
  );
  return {
    tasks: query.data,
    loading: query.loading,
    error: query.error,
    reload: query.reload,
  };
}
