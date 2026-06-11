import type { TaskInstance } from '@shared/types/task';
import { describe, expect, it } from 'vitest';
import {
  createTaskListRequestKey,
  deriveTaskListViewState,
} from './useTaskList';

function createTask(id: string): TaskInstance {
  return {
    id,
    definitionId: `definition-${id}`,
    category: 'daily',
    status: 'active',
    currentStage: 'daily-stage',
    objectives: [],
    metadata: {
      dailyKind: 'alchemy',
      resetKey: '2026-05-26',
      rewardSummary: ['灵石 x300'],
    },
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    completedAt: null,
    snapshot: {
      title: `${id}-task`,
      summary: `${id}-summary`,
      isCompleted: false,
      currentStageId: 'daily-stage',
      currentStageIndex: 0,
      totalStages: 1,
      missingRequirements: [],
      dailyKind: 'alchemy',
      resetKey: '2026-05-26',
      rewardSummary: ['灵石 x300'],
      stages: [],
    },
  };
}

describe('useTaskList helpers', () => {
  it('builds a stable request key from cultivator and status filters', () => {
    expect(createTaskListRequestKey('cultivator-1', 'active')).toBe(
      'cultivator-1:active:0',
    );
    expect(createTaskListRequestKey(undefined)).toBe('::0');
  });

  it('hides stale task results while a new request key is loading', () => {
    const view = deriveTaskListViewState(
      {
        requestKey: 'cultivator-1:active:1',
        tasks: [createTask('task-1')],
        loading: false,
        error: undefined,
      },
      'cultivator-1:completed:1',
      'cultivator-1',
    );

    expect(view).toEqual({
      tasks: [],
      loading: true,
      error: undefined,
    });
  });
});
