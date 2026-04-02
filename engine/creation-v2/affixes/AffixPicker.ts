import { AffixCandidate } from '../types';

export class AffixPicker {
  pick(pool: AffixCandidate[]): {
    candidate: AffixCandidate;
    totalWeight: number;
    rollScore: number;
  } {
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