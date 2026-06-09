import { describe, expect, it } from 'vitest';
import { resolveDungeonMapConfig } from '@shared/lib/game/mapSystem';
import type { DungeonState } from './types';
import { buildDungeonRoundLlmContext } from './llmContext';

function createDungeonState(): DungeonState {
  return {
    cultivatorId: 'cultivator-1',
    mapNodeId: 'map-1',
    playerInfo: {
      name: '韩立',
      realm: '元婴 后期',
      gender: '男',
      age: 120,
      lifespan: 800,
      personality: '谨慎',
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      resourceCaps: {
        maxHp: 1000,
        maxMp: 800,
      },
      spiritual_roots: ['木(天灵根)'],
      fates: ['稳中求胜(测试)'],
      skills: ['青元剑诀'],
      spirit_stones: 1000,
      background: '',
    },
    theme: '血色禁地',
    currentRound: 2,
    maxRounds: 5,
    history: [
      {
        round: 1,
        scene: '雾气深处传来妖兽低吼。',
        choice: '绕开兽群',
      },
    ],
    status: 'EXPLORING',
    dangerScore: 35,
    isFinished: false,
    location: {
      location: '血色禁地',
      location_tags: ['副本', '筑基丹主药', '空间禁制'],
      location_description: '每六十年开启一次，内部奇草无数。',
    },
    summary_of_sacrifice: [],
    accumulatedRewards: [],
    accumulatedHpLoss: 0,
    accumulatedMpLoss: 0,
  };
}

describe('buildDungeonRoundLlmContext', () => {
  it('exposes map realm and difficulty as the enemy generation authority', () => {
    const mapConfig = resolveDungeonMapConfig({
      id: 'map-1',
      name: '血色禁地',
      region: '天南',
      realm_requirement: '筑基',
      dungeon_config: { difficulty: 'hard' },
      tags: [],
      description: '',
      connections: [],
      x: 0,
      y: 0,
    });

    const context = buildDungeonRoundLlmContext({
      state: createDungeonState(),
      mapConfig,
      realmGap: 2,
      phase: '收获期：可稳取资源，代价宜轻。',
    });

    expect(context.map).toMatchObject({
      realmRequirement: '筑基',
      difficultyTier: 'hard',
      difficultyLabel: '险地',
      enemyDifficulty: 40,
      allowedEnemyRealmStages: ['中期', '后期'],
    });
    expect(context.player.realm).toBe('元婴 后期');
    expect(context).not.toHaveProperty('resourcePressure');
  });
});
