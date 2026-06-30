import type { Cultivator } from '@shared/types/cultivator';
import { NOVICE_EQUIPMENT } from '@shared/lib/noviceGuidance';
import type { TaskInstance } from '@shared/types/task';
import { describe, expect, it } from 'vitest';
import { getNextNoviceHomeAction } from './noviceHomeAction';

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    title: null,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 120,
    attributes: {
      vitality: 20,
      spirit: 20,
      wisdom: 20,
      speed: 20,
      willpower: 20,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: NOVICE_EQUIPMENT.map((equipment) => ({
        id: `artifact-${equipment.slot}`,
        name: equipment.name,
        slot: equipment.slot,
        element: '木',
      })),
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: 'artifact-weapon',
      armor: 'artifact-armor',
      accessory: 'artifact-accessory',
    },
    spirit_stones: 0,
    cultivation_progress: {
      cultivation_exp: 0,
      exp_cap: 250,
      comprehension_insight: 0,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    ...overrides,
  };
}

function tutorialTask(
  definitionId:
    | 'tutorial_starter_supply'
    | 'tutorial_first_alchemy'
    | 'tutorial_first_dungeon',
  overrides: Partial<TaskInstance> = {},
): TaskInstance {
  const titleById = {
    tutorial_starter_supply: '入门供给',
    tutorial_first_alchemy: '第一炉疗伤丹',
    tutorial_first_dungeon: '第一次低危探秘',
  };

  return {
    id: `task-${definitionId}`,
    definitionId,
    category: 'tutorial',
    status: 'active',
    currentStage: definitionId,
    objectives: [],
    metadata: {},
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    completedAt: null,
    snapshot: {
      title: titleById[definitionId],
      summary: `${titleById[definitionId]}摘要`,
      isCompleted: false,
      currentStageId: definitionId,
      currentStageIndex: 0,
      totalStages: 1,
      missingRequirements: [],
      stages: [],
    },
    ...overrides,
  };
}

function claimed(task: TaskInstance): TaskInstance {
  return {
    ...task,
    status: 'completed',
    metadata: {
      ...task.metadata,
      rewardClaimedAt: '2026-05-26T00:00:00.000Z',
    },
    snapshot: {
      ...task.snapshot,
      isCompleted: true,
      rewardClaimedAt: '2026-05-26T00:00:00.000Z',
    },
  };
}

describe('getNextNoviceHomeAction', () => {
  it('points to starter supply before any tutorial reward is claimed', () => {
    const action = getNextNoviceHomeAction({
      tasks: [tutorialTask('tutorial_starter_supply')],
      cultivator: createCultivator(),
});

    expect(action).toMatchObject({
      title: '📜 入门供给',
      href: '/game/tasks',
      label: '领取',
    });
  });

  it('points to starter alchemy after starter supply is claimed even when novice equipment is unequipped', () => {
    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        tutorialTask('tutorial_first_alchemy'),
      ],
      cultivator: createCultivator({
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
    });

    expect(action).toMatchObject({
      title: '📜 第一炉丹',
      href: '/game/craft/alchemy',
      label: '开炉',
    });
  });

  it('points to starter alchemy after novice equipment is ready', () => {
    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        tutorialTask('tutorial_first_alchemy'),
      ],
      cultivator: createCultivator(),
    });

    expect(action).toMatchObject({
      title: '📜 第一炉丹',
      href: '/game/craft/alchemy',
      label: '开炉',
    });
  });

  it('blocks the first dungeon action behind resource recovery', () => {
    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        claimed(tutorialTask('tutorial_first_alchemy')),
        tutorialTask('tutorial_first_dungeon'),
      ],
      cultivator: createCultivator(),
      hp: { current: 70, max: 100 },
      mp: { current: 100, max: 100 },
    });

    expect(action).toMatchObject({
      title: '📜 探秘准备',
      href: '/game/inn',
      label: '调息',
    });
  });

  it('points to the first dungeon even when novice equipment is unequipped', () => {
    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        claimed(tutorialTask('tutorial_first_alchemy')),
        tutorialTask('tutorial_first_dungeon'),
      ],
      cultivator: createCultivator({
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
      hp: { current: 100, max: 100 },
      mp: { current: 100, max: 100 },
    });

    expect(action).toMatchObject({
      title: '📜 低危探秘',
      href: '/game/dungeon',
      label: '探秘',
    });
  });

  it('points to recovery after first dungeon settlement when not full state', () => {
    const firstDungeon = tutorialTask('tutorial_first_dungeon', {
      status: 'completed',
      snapshot: {
        ...tutorialTask('tutorial_first_dungeon').snapshot,
        isCompleted: true,
      },
    });

    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        claimed(tutorialTask('tutorial_first_alchemy')),
        firstDungeon,
      ],
      cultivator: createCultivator(),
      hp: { current: 95, max: 100 },
      mp: { current: 100, max: 100 },
    });

    expect(action).toMatchObject({
      title: '📜 战后调息',
      href: '/game/inn',
      label: '调息',
    });
  });

  it('returns null after all tutorial rewards are claimed', () => {
    const action = getNextNoviceHomeAction({
      tasks: [
        claimed(tutorialTask('tutorial_starter_supply')),
        claimed(tutorialTask('tutorial_first_alchemy')),
        claimed(tutorialTask('tutorial_first_dungeon')),
      ],
      cultivator: createCultivator(),
    });

    expect(action).toBeNull();
  });
});
