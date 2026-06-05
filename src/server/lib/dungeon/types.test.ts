import { describe, expect, it } from 'vitest';
import {
  DungeonCostSchema as serverDungeonCostSchema,
  DungeonRoundSchema as serverDungeonRoundSchema,
} from './types';
import {
  DungeonCostSchema as sharedDungeonCostSchema,
  DungeonRoundSchema as sharedDungeonRoundSchema,
} from '@shared/lib/dungeon/types';

const validBattleCost = {
  type: 'battle' as const,
  value: 68,
  metadata: {
    race: '鬼魂' as const,
    realm_stage: '后期' as const,
    enemy_name: '守陵阴魂',
  },
};

describe('dungeon battle metadata schemas', () => {
  it.each([
    ['shared', sharedDungeonCostSchema],
    ['server', serverDungeonCostSchema],
  ])('%s DungeonCostSchema requires battle metadata', (_, schema) => {
    expect(schema.safeParse(validBattleCost).success).toBe(true);
    expect(
      schema.safeParse({
        type: 'battle',
        value: 68,
      }).success,
    ).toBe(false);
  });

  it.each([
    ['shared', sharedDungeonRoundSchema],
    ['server', serverDungeonRoundSchema],
  ])('%s DungeonRoundSchema rejects battle costs missing race or realm_stage', (_, schema) => {
    const missingRace = schema.safeParse({
      scene_description: '阴风穿阵，尸气弥散。',
      interaction: {
        options: [
          {
            id: 1,
            text: '强闯中枢',
            risk_level: 'high',
            costs: [
              {
                type: 'battle',
                value: 72,
                metadata: {
                  realm_stage: '后期',
                },
              },
            ],
          },
        ],
      },
      status_update: {
        is_final_round: false,
        internal_danger_score: 72,
      },
    });

    const missingRealmStage = schema.safeParse({
      scene_description: '阴风穿阵，尸气弥散。',
      interaction: {
        options: [
          {
            id: 1,
            text: '强闯中枢',
            risk_level: 'high',
            costs: [
              {
                type: 'battle',
                value: 72,
                metadata: {
                  race: '鬼魂',
                },
              },
            ],
          },
        ],
      },
      status_update: {
        is_final_round: false,
        internal_danger_score: 72,
      },
    });

    expect(missingRace.success).toBe(false);
    expect(missingRealmStage.success).toBe(false);
  });

  it.each([
    ['shared', sharedDungeonCostSchema],
    ['server', serverDungeonCostSchema],
  ])('%s DungeonCostSchema rejects negative and non-finite values', (_, schema) => {
    expect(
      schema.safeParse({
        type: 'lifespan',
        value: -1,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        type: 'lifespan',
        value: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        type: 'comprehension_insight',
        value: Number.NaN,
      }).success,
    ).toBe(false);
  });
});
