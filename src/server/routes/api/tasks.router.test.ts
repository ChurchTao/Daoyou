import { Hono } from 'hono';

const {
  claimTaskRewardMock,
  listCultivatorTasksMock,
  getCultivatorTaskMock,
  runTaskChallengeMock,
} = vi.hoisted(() => ({
  claimTaskRewardMock: vi.fn(),
  listCultivatorTasksMock: vi.fn(),
  getCultivatorTaskMock: vi.fn(),
  runTaskChallengeMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  db: vi.fn(),
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: 'user-1',
    });
    context.set('cultivator', {
      id: 'cultivator-1',
    });
    await next();
  },
  requireActiveCultivatorRef:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', {
        id: 'user-1',
      });
      context.set('activeCultivatorRef', {
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        status: 'active',
      });
      await next();
    },
}));

vi.mock('@server/lib/services/TaskService', () => ({
  TaskService: {
    claimTaskReward: claimTaskRewardMock,
    listCultivatorTasks: listCultivatorTasksMock,
    getCultivatorTask: getCultivatorTaskMock,
    runTaskChallenge: runTaskChallengeMock,
  },
}));

import { db } from '@server/lib/drizzle/db';
import taskRouter from './tasks.router';

const dbMock = db as unknown as ReturnType<typeof vi.fn>;

function createApp() {
  return new Hono().route('/api/tasks', taskRouter);
}

function mockTaskClaimTransaction(unreadMailCount: number) {
  const selectWhere = vi.fn().mockResolvedValue([{ count: unreadMailCount }]);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const versionRow = {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 0,
    conditionVersion: 0,
    progressVersion: 0,
    currencyVersion: 0,
    loadoutVersion: 0,
    mailVersion: 1,
    tasksVersion: 1,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const eventRows = [
    {
      id: 41,
      cultivatorId: 'cultivator-1',
      userId: 'user-1',
      globalVersion: 1,
      domain: 'tasks',
      eventType: 'tasks.reward_claimed',
      patch: {},
      invalidates: ['tasks'],
      source: 'task_claim_reward',
      requestId: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    },
  ];
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { select, insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  });

  return txMock;
}

describe('tasks router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tasks by status', async () => {
    listCultivatorTasksMock.mockResolvedValueOnce([
      {
        id: 'task-1',
        status: 'active',
      },
    ]);

    const response = await createApp().request('/api/tasks?status=active');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        tasks: [
          {
            id: 'task-1',
            status: 'active',
          },
        ],
      },
    });
    expect(listCultivatorTasksMock).toHaveBeenCalledWith(
      'cultivator-1',
      'active',
    );
  });

  it('returns task detail when the task exists', async () => {
    getCultivatorTaskMock.mockResolvedValueOnce({
      id: 'task-9',
      status: 'completed',
      snapshot: {
        title: '筑基前引',
      },
    });

    const response = await createApp().request('/api/tasks/task-9');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        task: {
          id: 'task-9',
          status: 'completed',
          snapshot: {
            title: '筑基前引',
          },
        },
      },
    });
    expect(getCultivatorTaskMock).toHaveBeenCalledWith(
      'cultivator-1',
      'task-9',
    );
  });

  it('maps challenge conflicts to 409 responses', async () => {
    runTaskChallengeMock.mockRejectedValueOnce(
      new Error('当前阶段没有可执行的试炼挑战'),
    );

    const response = await createApp().request('/api/tasks/task-2/challenge', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '当前阶段没有可执行的试炼挑战',
    });
  });

  it('claims tutorial rewards through the active user and cultivator', async () => {
    const txMock = mockTaskClaimTransaction(3);
    claimTaskRewardMock.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        status: 'completed',
      },
      rewards: ['修为 x40'],
    });

    const response = await createApp().request('/api/tasks/task-1/claim-reward', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        task: {
          id: 'task-1',
          status: 'completed',
        },
        rewards: ['修为 x40'],
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          tasks: 1,
          mail: 1,
        },
        events: [
          {
            id: 41,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'tasks',
            eventType: 'tasks.reward_claimed',
            patch: {},
            invalidates: ['tasks'],
            source: 'task_claim_reward',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
      },
    });
    expect(claimTaskRewardMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'task-1',
      { tx: txMock },
    );
  });
});
