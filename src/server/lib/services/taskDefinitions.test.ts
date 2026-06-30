import { describe, expect, it } from 'vitest';

import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import { buildDifficultyFactor } from '@shared/engine/enemy-generation/utils';
import type { Cultivator } from '@shared/types/cultivator';
import { getTaskChallengeProfile } from './taskDefinitions';

function sumAttributes(attributes: Cultivator['attributes']): number {
  return Object.values(attributes).reduce((sum, value) => sum + value, 0);
}

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    title: null,
    gender: '男',
    realm: '金丹',
    realm_stage: '圆满',
    age: 180,
    lifespan: 500,
    status: 'active',
    attributes: {
      vitality: 20,
      spirit: 23,
      wisdom: 27,
      speed: 19,
      willpower: 25,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    spirit_stones: 0,
    condition: {
      version: 1,
      resources: {
        hp: { current: 100 },
        mp: { current: 100 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    },
    ...overrides,
  };
}

describe('taskDefinitions heart demon challenge', () => {
  it('matches the cultivator attributes when clear_mind is active', async () => {
    const profile = getTaskChallengeProfile('heart_demon_nascent');
    const cultivator = createCultivator({
      condition: {
        ...createCultivator().condition!,
        statuses: [
          {
            key: 'clear_mind',
            stacks: 1,
            source: 'pill',
            duration: { kind: 'until_removed' },
            usesRemaining: 1,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
    });

    const opponent = await profile?.buildOpponent(cultivator);

    expect(opponent).toBeTruthy();
    expect(opponent?.name).toBe('心魔化身');
    expect(opponent?.attributes).toEqual(cultivator.attributes);
  });

  it('keeps the heart demon stronger without clear_mind', async () => {
    const profile = getTaskChallengeProfile('heart_demon_nascent');
    const cultivator = createCultivator();

    const opponent = await profile?.buildOpponent(cultivator);

    expect(opponent).toBeTruthy();
    expect(opponent?.attributes).toEqual({
      vitality: 21,
      spirit: 24,
      wisdom: 29,
      speed: 24,
      willpower: 33,
    });
  });

  it.each([
    {
      challengeId: 'tribulation_deity',
      realm: '元婴',
      realmStage: '圆满',
      enemyDifficulty: 65,
    },
    {
      challengeId: 'law_insight_void',
      realm: '化神',
      realmStage: '圆满',
      enemyDifficulty: 75,
    },
    {
      challengeId: 'tribulation_body',
      realm: '炼虚',
      realmStage: '圆满',
      enemyDifficulty: 90,
    },
    {
      challengeId: 'heavenly_tribulation_final',
      realm: '大乘',
      realmStage: '圆满',
      enemyDifficulty: 100,
    },
  ] as const)(
    'uses enemy-generator 0-100 difficulty for $challengeId',
    async ({ challengeId, realm, realmStage, enemyDifficulty }) => {
      const profile = getTaskChallengeProfile(challengeId);
      const cultivator = createCultivator({ realm, realm_stage: realmStage });

      const opponent = await profile?.buildOpponent(cultivator);

      expect(profile?.enemyDifficulty).toBe(enemyDifficulty);
      expect(opponent).toBeTruthy();
      expect(sumAttributes(opponent!.attributes)).toBe(
        Math.round(
          getRealmStageAttributeBudget(realm, realmStage) *
            buildDifficultyFactor(enemyDifficulty),
        ),
      );
    },
  );
});
