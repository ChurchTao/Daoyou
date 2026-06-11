import { fetchTaskList } from '@app/lib/tasks/taskClient';
import { usePlayerStateDomainVersion } from '@app/lib/player-state/selectors';
import type { TaskInstance, TaskStatus } from '@shared/types/task';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TaskListState {
  requestKey: string;
  tasks: TaskInstance[];
  loading: boolean;
  error: string | undefined;
}

export function createTaskListRequestKey(
  cultivatorId: string | undefined,
  status?: TaskStatus,
  domainVersion = 0,
) {
  return `${cultivatorId ?? ''}:${status ?? ''}:${domainVersion}`;
}

export function deriveTaskListViewState(
  state: TaskListState,
  requestKey: string,
  cultivatorId: string | undefined,
) {
  if (!cultivatorId) {
    return {
      tasks: [],
      loading: false,
      error: undefined,
    };
  }

  if (state.requestKey !== requestKey) {
    return {
      tasks: [],
      loading: true,
      error: undefined,
    };
  }

  return {
    tasks: state.tasks,
    loading: state.loading,
    error: state.error,
  };
}

async function readTaskList(status?: TaskStatus) {
  const response = await fetchTaskList(status);
  return response.data.tasks;
}

export function useTaskList(
  cultivatorId: string | undefined,
  status?: TaskStatus,
) {
  const tasksVersion = usePlayerStateDomainVersion('tasks');
  const requestKey = createTaskListRequestKey(
    cultivatorId,
    status,
    tasksVersion,
  );
  const requestVersionRef = useRef(0);
  const [state, setState] = useState<TaskListState>(() => ({
    requestKey,
    tasks: [],
    loading: Boolean(cultivatorId),
    error: undefined,
  }));

  const runTaskListRequest = useCallback(
    async (targetRequestKey: string, version: number) => {
      try {
        const tasks = await readTaskList(status);
        if (requestVersionRef.current !== version) {
          return;
        }

        setState({
          requestKey: targetRequestKey,
          tasks,
          loading: false,
          error: undefined,
        });
      } catch (requestError) {
        if (requestVersionRef.current !== version) {
          return;
        }

        setState({
          requestKey: targetRequestKey,
          tasks: [],
          loading: false,
          error:
            requestError instanceof Error
              ? requestError.message
              : '获取任务列表失败',
        });
      }
    },
    [status],
  );

  useEffect(() => {
    const version = requestVersionRef.current + 1;
    requestVersionRef.current = version;

    if (!cultivatorId) {
      return;
    }

    void runTaskListRequest(requestKey, version);
  }, [cultivatorId, requestKey, runTaskListRequest]);

  const { tasks, loading, error } = deriveTaskListViewState(
    state,
    requestKey,
    cultivatorId,
  );

  return {
    tasks,
    loading,
    error,
  };
}
