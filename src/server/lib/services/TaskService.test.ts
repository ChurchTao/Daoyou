import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const {
  createCultivatorTaskMock,
  findActiveCultivatorRecordByIdMock,
  findCultivatorTaskByDefinitionMock,
  findCultivatorTaskByIdMock,
  getCultivatorByIdUnsafeMock,
  listCultivatorBreakthroughPillsMock,
  listCultivatorTasksMock,
  listCultivatorTechniqueQualitiesMock,
  sendMailMock,
  updateCultivatorTaskMock,
} = vi.hoisted(() => ({
  createCultivatorTaskMock: vi.fn(),
  findActiveCultivatorRecordByIdMock: vi.fn(),
  findCultivatorTaskByDefinitionMock: vi.fn(),
  findCultivatorTaskByIdMock: vi.fn(),
  getCultivatorByIdUnsafeMock: vi.fn(),
  listCultivatorBreakthroughPillsMock: vi.fn(),
  listCultivatorTasksMock: vi.fn(),
  listCultivatorTechniqueQualitiesMock: vi.fn(),
  sendMailMock: vi.fn(),
  updateCultivatorTaskMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/cultivatorRepository', () => ({
  findActiveCultivatorRecordById: findActiveCultivatorRecordByIdMock,
  listCultivatorBreakthroughPills: listCultivatorBreakthroughPillsMock,
  listCultivatorTechniqueQualities: listCultivatorTechniqueQualitiesMock,
}));

vi.mock('./cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('@server/lib/repositories/taskRepository', () => ({
  createCultivatorTask: createCultivatorTaskMock,
  findCultivatorTaskByDefinition: findCultivatorTaskByDefinitionMock,
  findCultivatorTaskById: findCultivatorTaskByIdMock,
  listCultivatorTasks: listCultivatorTasksMock,
  updateCultivatorTask: updateCultivatorTaskMock,
}));

vi.mock('./MailService', () => ({
  MailService: {
    sendMail: sendMailMock,
  },
}));

vi.mock('./simulateBattleV5', () => ({
  simulateBattleV5: vi.fn(),
}));

import { TaskService } from './TaskService';

let taskStore = new Map<string, any>();

function createCultivatorRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cultivator-1',
    userId: 'user-1',
    name: '韩立',
    title: null,
    gender: null,
    origin: null,
    personality: null,
    background: null,
    prompt: '谨慎求道',
    realm: '炼气',
    realm_stage: '圆满',
    age: 28,
    lifespan: 120,
    closedDoorYearsTotal: 12,
    status: 'active',
    diedAt: null,
    vitality: 18,
    spirit: 22,
    wisdom: 24,
    speed: 16,
    willpower: 25,
    spirit_stones: 320,
    last_yield_at: new Date('2026-05-21T00:00:00.000Z'),
    max_skills: 4,
    balance_notes: null,
    condition: {
      statuses: [],
    },
    cultivation_progress: {
      cultivation_exp: 3000,
      exp_cap: 3000,
      comprehension_insight: 55,
      breakthrough_failures: 0,
      bottleneck_state: true,
      inner_demon: false,
      deviation_risk: 0,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    ...overrides,
  } as any;
}

function createFoundationTaskRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-major-1',
    cultivatorId: 'cultivator-1',
    definitionId: 'major_breakthrough_炼气_筑基',
    category: 'breakthrough_major',
    status: 'active',
    currentStage: 'foundation-pill',
    objectives: [
      {
        objectiveId: 'craft-pill',
        completed: false,
      },
      {
        objectiveId: 'clear-garden',
        completed: true,
        progressValue: 1,
        completedAt: '2026-05-21T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      },
    ],
    metadata: {
      fromRealm: '炼气',
      toRealm: '筑基',
      taskTheme: 'foundation',
    },
    completedAt: null,
    createdAt: new Date('2026-05-21T00:00:00.000Z'),
    updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    ...overrides,
  } as any;
}

function createDailyTaskRecord(
  definitionId: 'daily_alchemy_once' | 'daily_dungeon_once' | 'daily_ranking_once',
  overrides: Record<string, unknown> = {},
) {
  const metaByDefinition = {
    daily_alchemy_once: {
      stageId: 'daily-alchemy-stage',
      dailyKind: 'alchemy',
      rewardSummary: ['灵石 x1000'],
      objectiveId: 'daily-alchemy-objective',
    },
    daily_dungeon_once: {
      stageId: 'daily-dungeon-stage',
      dailyKind: 'dungeon',
      rewardSummary: ['灵石 x1000'],
      objectiveId: 'daily-dungeon-objective',
    },
    daily_ranking_once: {
      stageId: 'daily-ranking-stage',
      dailyKind: 'ranking',
      rewardSummary: ['灵石 x1000'],
      objectiveId: 'daily-ranking-objective',
    },
  } as const;

  const meta = metaByDefinition[definitionId];

  return {
    id: `task-${definitionId}`,
    cultivatorId: 'cultivator-1',
    definitionId,
    category: 'daily',
    status: 'active',
    currentStage: meta.stageId,
    objectives: [
      {
        objectiveId: meta.objectiveId,
        completed: false,
        progressValue: 0,
      },
    ],
    metadata: {
      dailyKind: meta.dailyKind,
      resetKey: '2026-05-26',
      rewardSummary: meta.rewardSummary,
    },
    completedAt: null,
    createdAt: new Date('2026-05-26T00:00:00.000Z'),
    updatedAt: new Date('2026-05-26T00:00:00.000Z'),
    ...overrides,
  } as any;
}

function installTaskStoreMocks() {
  createCultivatorTaskMock.mockImplementation(async (input: any) => {
    const now = new Date();
    const record = {
      id: `task-${input.definitionId}`,
      cultivatorId: input.cultivatorId,
      definitionId: input.definitionId,
      category: input.category,
      status: input.status,
      currentStage: input.currentStage,
      objectives: input.objectives,
      metadata: input.metadata,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    taskStore.set(record.id, record);
    return record;
  });

  findCultivatorTaskByDefinitionMock.mockImplementation(
    async (_cultivatorId: string, definitionId: string) =>
      [...taskStore.values()].find((task) => task.definitionId === definitionId) ?? null,
  );

  findCultivatorTaskByIdMock.mockImplementation(
    async (_cultivatorId: string, taskId: string) => taskStore.get(taskId) ?? null,
  );

  listCultivatorTasksMock.mockImplementation(
    async (
      _cultivatorId: string,
      options: {
        status?: 'active' | 'completed';
      } = {},
    ) => {
      const tasks = [...taskStore.values()].sort((left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime(),
      );
      if (!options.status) {
        return tasks;
      }

      return tasks.filter((task) => task.status === options.status);
    },
  );

  updateCultivatorTaskMock.mockImplementation(
    async (_taskId: string, _cultivatorId: string, input: any) => {
      const record = taskStore.get(_taskId);
      if (!record) {
        return null;
      }

      const next = {
        ...record,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.currentStage !== undefined
          ? { currentStage: input.currentStage }
          : {}),
        ...(input.objectives !== undefined ? { objectives: input.objectives } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
        updatedAt: new Date(),
      };
      taskStore.set(_taskId, next);
      return next;
    },
  );
}

describe('TaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T02:00:00.000Z'));

    taskStore = new Map<string, any>();
    installTaskStoreMocks();

    findActiveCultivatorRecordByIdMock.mockResolvedValue(createCultivatorRecord());
    listCultivatorTechniqueQualitiesMock.mockResolvedValue([]);
    listCultivatorBreakthroughPillsMock.mockResolvedValue([]);
    getCultivatorByIdUnsafeMock.mockResolvedValue(null);
    sendMailMock.mockResolvedValue({ id: 'mail-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs task progress from lightweight context without loading full cultivator', async () => {
    taskStore.set('task-major-1', createFoundationTaskRecord());
    listCultivatorBreakthroughPillsMock.mockResolvedValue([
      {
        spec: {
          kind: 'pill',
          family: 'breakthrough',
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: ['火灵草'],
            stability: 74,
            toxicityRating: 12,
            tags: ['breakthrough'],
            breakthroughTargetRealm: '筑基',
            breakthroughLabel: '筑基丹',
          },
        },
        quantity: 1,
      },
    ]);

    const tasks = await TaskService.syncCultivatorTasks('cultivator-1');

    expect(getCultivatorByIdUnsafeMock).not.toHaveBeenCalled();
    expect(updateCultivatorTaskMock).toHaveBeenCalled();
    expect(
      tasks.find((task) => task.definitionId === 'major_breakthrough_炼气_筑基'),
    ).toMatchObject({
      status: 'completed',
      snapshot: {
        isCompleted: true,
        currentStageId: null,
      },
    });
  });

  it('creates the three fixed daily task records during sync', async () => {
    findActiveCultivatorRecordByIdMock.mockResolvedValue(
      createCultivatorRecord({
        realm_stage: '初期',
      }),
    );

    const tasks = await TaskService.syncCultivatorTasks('cultivator-1');

    expect(createCultivatorTaskMock).toHaveBeenCalledTimes(3);
    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.definitionId).sort()).toEqual([
      'daily_alchemy_once',
      'daily_dungeon_once',
      'daily_ranking_once',
    ]);
  });

  it('resets stale daily tasks when a new day begins', async () => {
    findActiveCultivatorRecordByIdMock.mockResolvedValue(
      createCultivatorRecord({
        realm_stage: '初期',
      }),
    );
    taskStore.set(
      'task-daily_dungeon_once',
      createDailyTaskRecord('daily_dungeon_once', {
        status: 'completed',
        currentStage: null,
        objectives: [
          {
            objectiveId: 'daily-dungeon-objective',
            completed: true,
            progressValue: 1,
            completedAt: '2026-05-25T08:00:00.000Z',
            updatedAt: '2026-05-25T08:00:00.000Z',
          },
        ],
        metadata: {
          dailyKind: 'dungeon',
          resetKey: '2026-05-25',
          rewardSummary: ['灵石 x1000'],
        },
        completedAt: new Date('2026-05-25T08:00:00.000Z'),
      }),
    );

    const tasks = await TaskService.syncCultivatorTasks('cultivator-1');
    const dailyTask = tasks.find((task) => task.definitionId === 'daily_dungeon_once');

    expect(dailyTask).toMatchObject({
      status: 'active',
      metadata: {
        dailyKind: 'dungeon',
        resetKey: '2026-05-26',
      },
      snapshot: {
        isCompleted: false,
        resetKey: '2026-05-26',
      },
    });
    expect(dailyTask?.objectives[0]).toMatchObject({
      objectiveId: 'daily-dungeon-objective',
      completed: false,
    });
  });

  it('reuses one lightweight context load in major breakthrough gate checks', async () => {
    taskStore.set('task-major-1', createFoundationTaskRecord());
    listCultivatorTechniqueQualitiesMock.mockResolvedValue([{ quality: '玄品' }]);

    const gate = await TaskService.getMajorBreakthroughGate('cultivator-1');

    expect(gate).toMatchObject({
      required: true,
      blocked: true,
      task: {
        definitionId: 'major_breakthrough_炼气_筑基',
      },
    });
    expect(findActiveCultivatorRecordByIdMock).toHaveBeenCalledTimes(1);
    expect(listCultivatorTechniqueQualitiesMock).toHaveBeenCalledTimes(1);
    expect(listCultivatorBreakthroughPillsMock).toHaveBeenCalledTimes(1);
    expect(getCultivatorByIdUnsafeMock).not.toHaveBeenCalled();
  });

  it('records only the matching daily event and sends its reward once', async () => {
    findActiveCultivatorRecordByIdMock.mockResolvedValue(
      createCultivatorRecord({
        realm_stage: '初期',
      }),
    );
    taskStore.set('task-daily_alchemy_once', createDailyTaskRecord('daily_alchemy_once'));
    taskStore.set('task-daily_dungeon_once', createDailyTaskRecord('daily_dungeon_once'));
    taskStore.set('task-daily_ranking_once', createDailyTaskRecord('daily_ranking_once'));

    const firstTasks = await TaskService.recordTaskEvent(
      'cultivator-1',
      'dungeon_completed',
    );

    expect(
      firstTasks.find((task) => task.definitionId === 'daily_dungeon_once'),
    ).toMatchObject({
      status: 'completed',
      snapshot: {
        isCompleted: true,
      },
    });
    expect(
      firstTasks.find((task) => task.definitionId === 'daily_alchemy_once'),
    ).toMatchObject({
      status: 'active',
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      'cultivator-1',
      '【今日日常】云游一程',
      expect.stringContaining('云游一程'),
      [{ type: 'spirit_stones', name: '灵石', quantity: 1000 }],
      'reward',
    );

    await TaskService.recordTaskEvent('cultivator-1', 'dungeon_completed');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('scales daily reward summary and mail attachments by current realm', async () => {
    findActiveCultivatorRecordByIdMock.mockResolvedValue(
      createCultivatorRecord({
        realm: '渡劫',
        realm_stage: '初期',
      }),
    );
    taskStore.set(
      'task-daily_dungeon_once',
      createDailyTaskRecord('daily_dungeon_once', {
        metadata: {
          dailyKind: 'dungeon',
          resetKey: '2026-05-26',
          rewardSummary: ['灵石 x1000'],
        },
      }),
    );

    const tasks = await TaskService.syncCultivatorTasks('cultivator-1');
    const dailyTask = tasks.find((task) => task.definitionId === 'daily_dungeon_once');

    expect(dailyTask).toMatchObject({
      metadata: {
        rewardSummary: ['灵石 x9000'],
      },
      snapshot: {
        rewardSummary: ['灵石 x9000'],
      },
    });

    await TaskService.recordTaskEvent('cultivator-1', 'dungeon_completed');

    expect(sendMailMock).toHaveBeenCalledWith(
      'cultivator-1',
      '【今日日常】云游一程',
      expect.stringContaining('云游一程'),
      [{ type: 'spirit_stones', name: '灵石', quantity: 9000 }],
      'reward',
    );
  });
});
