import type { TaskChallengeResponse } from '@shared/contracts/task';
import type { Cultivator } from '@shared/types/cultivator';
import type { TaskInstance } from '@shared/types/task';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findCurrentMajorBreakthroughTask,
  findNextTutorialTask,
  startTaskChallengeOnce,
} from './taskClient';

function createCultivator(
  overrides: Partial<Cultivator> = {},
): Cultivator {
  return {
    id: overrides.id ?? 'cultivator-1',
    name: overrides.name ?? '韩立',
    title: overrides.title ?? null,
    gender: overrides.gender ?? '男',
    realm: overrides.realm ?? '炼气',
    realm_stage: overrides.realm_stage ?? '圆满',
    age: overrides.age ?? 120,
    lifespan: overrides.lifespan ?? 300,
    attributes: overrides.attributes ?? {
      vitality: 20,
      spirit: 20,
      wisdom: 20,
      speed: 20,
      willpower: 20,
    },
    spiritual_roots: overrides.spiritual_roots ?? [],
    pre_heaven_fates: overrides.pre_heaven_fates ?? [],
    cultivations: overrides.cultivations ?? [],
    skills: overrides.skills ?? [],
    inventory: overrides.inventory ?? {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: overrides.equipped ?? {
      weapon: null,
      armor: null,
      accessory: null,
    },
    spirit_stones: overrides.spirit_stones ?? 0,
    cultivation_progress: overrides.cultivation_progress ?? {
      cultivation_exp: 100,
      exp_cap: 100,
      comprehension_insight: 65,
      breakthrough_failures: 0,
      bottleneck_state: true,
      inner_demon: false,
      deviation_risk: 0,
    },
  };
}

function createTask(
  overrides: Partial<TaskInstance> = {},
): TaskInstance {
  return {
    id: overrides.id ?? 'task-1',
    definitionId: overrides.definitionId ?? 'major_breakthrough_炼气_筑基',
    category: overrides.category ?? 'breakthrough_major',
    status: overrides.status ?? 'active',
    currentStage: overrides.currentStage ?? 'foundation-pill',
    objectives: overrides.objectives ?? [],
    metadata: overrides.metadata ?? {
      fromRealm: '炼气',
      toRealm: '筑基',
      taskTheme: 'foundation',
    },
    createdAt: overrides.createdAt ?? '2026-05-21T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-21T00:00:00.000Z',
    completedAt: overrides.completedAt ?? null,
    snapshot: overrides.snapshot ?? {
      title: '筑基前引',
      summary: '先凝住一口破境心气，再经药园试炼稳住根基。',
      fromRealm: '炼气',
      toRealm: '筑基',
      isCompleted: false,
      currentStageId: 'foundation-pill',
      currentStageIndex: 0,
      totalStages: 2,
      missingRequirements: [],
      stages: [],
    },
  };
}

function createChallengeResponse(): TaskChallengeResponse {
  const winner = createCultivator({ id: 'cultivator-1', name: '韩立' });
  const loser = createCultivator({ id: 'enemy-1', name: '心魔化身' });

  return {
    success: true,
    data: {
      task: createTask(),
      battleResult: {
        winner,
        loser,
        logs: [],
        turns: 1,
        player: winner.id,
        opponent: loser.id,
        logSpans: [],
        stateTimeline: [],
        winnerSnapshot: {} as never,
      },
      isWin: true,
      challengeTitle: '心魔劫',
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startTaskChallengeOnce', () => {
  it('dedupes concurrent task challenge executions', async () => {
    const payload = createChallengeResponse();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      startTaskChallengeOnce('task-1'),
      startTaskChallengeOnce('task-1'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/task-1/challenge', {
      method: 'POST',
    });
    expect(second).toBe(first);

    await startTaskChallengeOnce('task-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('findCurrentMajorBreakthroughTask', () => {
  it('returns the task matching the current major transition', () => {
    const cultivator = createCultivator();
    const currentTask = createTask();
    const unrelatedTask = createTask({
      id: 'task-2',
      definitionId: 'major_breakthrough_筑基_金丹',
      metadata: {
        fromRealm: '筑基',
        toRealm: '金丹',
        taskTheme: 'core',
      },
      snapshot: {
        title: '凝丹之机',
        summary: '丹法并备。',
        fromRealm: '筑基',
        toRealm: '金丹',
        isCompleted: false,
        currentStageId: 'core-prep',
        currentStageIndex: 0,
        totalStages: 2,
        missingRequirements: [],
        stages: [],
      },
    });

    expect(
      findCurrentMajorBreakthroughTask(cultivator, [unrelatedTask, currentTask]),
    ).toBe(currentTask);
  });

  it('returns null when the cultivator is not at realm completion', () => {
    const cultivator = createCultivator({
      realm_stage: '后期',
    });

    expect(findCurrentMajorBreakthroughTask(cultivator, [createTask()])).toBeNull();
  });

  it('ignores daily tasks that happen to lack breakthrough metadata', () => {
    const cultivator = createCultivator();
    const dailyTask = createTask({
      id: 'daily-1',
      definitionId: 'daily_alchemy_once',
      category: 'daily',
      metadata: {
        dailyKind: 'alchemy',
        resetKey: '2026-05-26',
        rewardSummary: ['灵石 x300'],
      },
      snapshot: {
        title: '丹炉留痕',
        summary: '今日开炉一次，让炉火与药意都别生疏。',
        isCompleted: false,
        currentStageId: 'daily-alchemy-stage',
        currentStageIndex: 0,
        totalStages: 1,
        missingRequirements: [],
        dailyKind: 'alchemy',
        resetKey: '2026-05-26',
        rewardSummary: ['灵石 x300'],
        stages: [],
      },
    });

    expect(findCurrentMajorBreakthroughTask(cultivator, [dailyTask])).toBeNull();
  });
});

describe('findNextTutorialTask', () => {
  it('prioritizes a completed tutorial task with unclaimed reward', () => {
    const claimedTask = createTask({
      id: 'tutorial-claimed',
      definitionId: 'tutorial_starter_supply',
      category: 'tutorial',
      status: 'completed',
      metadata: {
        rewardClaimedAt: '2026-05-26T00:00:00.000Z',
      },
      snapshot: {
        title: '入门供给',
        summary: '先领一份洞府供给。',
        isCompleted: true,
        currentStageId: null,
        currentStageIndex: 1,
        totalStages: 1,
        missingRequirements: [],
        rewardClaimedAt: '2026-05-26T00:00:00.000Z',
        stages: [],
      },
    });
    const unclaimedTask = createTask({
      id: 'tutorial-unclaimed',
      definitionId: 'tutorial_first_alchemy',
      category: 'tutorial',
      status: 'completed',
      metadata: {},
      snapshot: {
        title: '第一炉疗伤丹',
        summary: '完成一次炼丹。',
        isCompleted: true,
        currentStageId: null,
        currentStageIndex: 1,
        totalStages: 1,
        missingRequirements: [],
        stages: [],
      },
    });

    expect(findNextTutorialTask([claimedTask, unclaimedTask])).toBe(
      unclaimedTask,
    );
  });

  it('returns the active tutorial task when no completed reward is pending', () => {
    const starterTask = createTask({
      id: 'tutorial-starter',
      definitionId: 'tutorial_starter_supply',
      category: 'tutorial',
      status: 'completed',
      metadata: {
        rewardClaimedAt: '2026-05-26T00:00:00.000Z',
      },
      snapshot: {
        title: '入门供给',
        summary: '先领一份洞府供给。',
        isCompleted: true,
        currentStageId: null,
        currentStageIndex: 1,
        totalStages: 1,
        missingRequirements: [],
        rewardClaimedAt: '2026-05-26T00:00:00.000Z',
        stages: [],
      },
    });
    const alchemyTask = createTask({
      id: 'tutorial-alchemy',
      definitionId: 'tutorial_first_alchemy',
      category: 'tutorial',
      status: 'completed',
      metadata: {
        rewardClaimedAt: '2026-05-26T00:10:00.000Z',
      },
      snapshot: {
        title: '第一炉疗伤丹',
        summary: '完成一次炼丹。',
        isCompleted: true,
        currentStageId: null,
        currentStageIndex: 1,
        totalStages: 1,
        missingRequirements: [],
        rewardClaimedAt: '2026-05-26T00:10:00.000Z',
        stages: [],
      },
    });
    const activeTask = createTask({
      id: 'tutorial-active',
      definitionId: 'tutorial_first_dungeon',
      category: 'tutorial',
      status: 'active',
      metadata: {},
      snapshot: {
        title: '第一次低危探秘',
        summary: '完成一次探秘结算。',
        isCompleted: false,
        currentStageId: 'first-dungeon',
        currentStageIndex: 0,
        totalStages: 1,
        missingRequirements: ['完成 1 次探秘：0/1'],
        stages: [],
      },
    });

    expect(findNextTutorialTask([starterTask, alchemyTask, activeTask])).toBe(
      activeTask,
    );
  });

  it('keeps later tutorial tasks locked until the previous reward is claimed', () => {
    const starterTask = createTask({
      id: 'tutorial-starter',
      definitionId: 'tutorial_starter_supply',
      category: 'tutorial',
      status: 'completed',
      metadata: {},
      snapshot: {
        title: '入门供给',
        summary: '先领一份洞府供给。',
        isCompleted: true,
        currentStageId: null,
        currentStageIndex: 1,
        totalStages: 1,
        missingRequirements: [],
        stages: [],
      },
    });
    const alchemyTask = createTask({
      id: 'tutorial-alchemy',
      definitionId: 'tutorial_first_alchemy',
      category: 'tutorial',
      status: 'active',
      metadata: {},
      snapshot: {
        title: '第一炉疗伤丹',
        summary: '完成一次炼丹。',
        isCompleted: false,
        currentStageId: 'first-alchemy',
        currentStageIndex: 0,
        totalStages: 1,
        missingRequirements: [],
        stages: [],
      },
    });

    expect(findNextTutorialTask([alchemyTask, starterTask])).toBe(starterTask);
  });
});
