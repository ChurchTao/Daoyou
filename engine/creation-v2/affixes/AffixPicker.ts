/*
 * AffixPicker: 词缀抽签器（加权随机）。
 * 从候选池中根据权重随机选择一个词缀并返回 rollScore（用于审计/调试）。
 */
import { AffixCandidate } from '../types';

export class AffixPicker {
  pick(pool: AffixCandidate[]): {
    candidate: AffixCandidate;
    totalWeight: number;
    rollScore: number;
  } {
    if (pool.length === 0) {
      throw new Error('AffixPicker.pick(): cannot pick from empty pool');
    }

    const totalWeight = pool.reduce((sum, candidate) => sum + candidate.weight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of pool) {
      random -= candidate.weight;
      if (random <= 0) {
        return {
          candidate,
          totalWeight,
          rollScore: candidate.weight / totalWeight,
        };
      }
    }

    const fallback = pool[pool.length - 1];
    return {
      candidate: fallback,
      totalWeight,
      rollScore: fallback.weight / totalWeight,
    };
  }
}