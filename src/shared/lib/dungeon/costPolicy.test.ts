import { describe, expect, it } from 'vitest';
import {
  calculateDungeonMaterialCost,
  calculateDungeonResourceCost,
  calculateDungeonStatLoss,
  DUNGEON_COST_RANK_VALUES,
  DUNGEON_LIFESPAN_COST_MAX,
} from './costPolicy';

describe('dungeon cost policy', () => {
  it('keeps ranked resource costs deterministic and ordered', () => {
    const costs = DUNGEON_COST_RANK_VALUES.map((rank) =>
      calculateDungeonResourceCost({
        type: 'lifespan',
        realm: '渡劫',
        difficulty: 'boss',
        rank,
      }),
    );

    expect(costs).toEqual([32, 63, 110]);
    expect(costs[2]).toBeLessThanOrEqual(DUNGEON_LIFESPAN_COST_MAX);
  });

  it('never produces an excessive lifespan cost', () => {
    const realms = [
      '炼气',
      '筑基',
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ] as const;
    const difficulties = ['easy', 'normal', 'hard', 'elite', 'boss'] as const;

    for (const realm of realms) {
      for (const difficulty of difficulties) {
        for (const rank of DUNGEON_COST_RANK_VALUES) {
          const cost = calculateDungeonResourceCost({
            type: 'lifespan',
            realm,
            difficulty,
            rank,
          });
          expect(cost).toBeGreaterThanOrEqual(1);
          expect(cost).toBeLessThanOrEqual(DUNGEON_LIFESPAN_COST_MAX);
        }
      }
    }
  });

  it('scales resource costs with realm and difficulty', () => {
    const easy = calculateDungeonResourceCost({
      type: 'spirit_stones',
      realm: '炼气',
      difficulty: 'easy',
      rank: 'standard',
    });
    const boss = calculateDungeonResourceCost({
      type: 'spirit_stones',
      realm: '渡劫',
      difficulty: 'boss',
      rank: 'standard',
    });

    expect(easy).toBe(200);
    expect(boss).toBe(115_200);
  });

  it('derives material quantity and quality instead of accepting LLM values', () => {
    expect(
      calculateDungeonMaterialCost({
        realm: '炼气',
        difficulty: 'easy',
        rank: 'minor',
      }),
    ).toEqual({ requiredQuality: '凡品', value: 1 });
    expect(
      calculateDungeonMaterialCost({
        realm: '渡劫',
        difficulty: 'boss',
        rank: 'major',
      }),
    ).toEqual({ requiredQuality: '仙品', value: 3 });
  });

  it('caps proportional hp and mp losses', () => {
    expect(
      calculateDungeonStatLoss({
        realm: '炼气',
        difficulty: 'easy',
        rank: 'minor',
      }),
    ).toBe(0.02);
    expect(
      calculateDungeonStatLoss({
        realm: '渡劫',
        difficulty: 'boss',
        rank: 'major',
      }),
    ).toBe(0.15);
  });
});
