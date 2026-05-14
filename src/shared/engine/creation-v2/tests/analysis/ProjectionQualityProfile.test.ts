import { deriveProjectionQualityFromBudget } from '@shared/engine/creation-v2/analysis/ProjectionQualityProfile';
import type { EnergyBudget } from '@shared/engine/creation-v2/types';

function budget(effectiveTotal: number): EnergyBudget {
  return {
    baseTotal: effectiveTotal,
    effectiveTotal,
    reserved: 0,
    spent: 0,
    remaining: effectiveTotal,
    allocations: [],
    sources: [],
  };
}

describe('ProjectionQualityProfile', () => {
  it('应基于 effectiveTotal 分档推导 projectionQuality（边界值）', () => {
    expect(deriveProjectionQualityFromBudget(budget(0)).quality).toBe('凡品');
    expect(deriveProjectionQualityFromBudget(budget(17)).quality).toBe('凡品');
    expect(deriveProjectionQualityFromBudget(budget(18)).quality).toBe('灵品');

    expect(deriveProjectionQualityFromBudget(budget(29)).quality).toBe('灵品');
    expect(deriveProjectionQualityFromBudget(budget(30)).quality).toBe('玄品');

    expect(deriveProjectionQualityFromBudget(budget(44)).quality).toBe('玄品');
    expect(deriveProjectionQualityFromBudget(budget(45)).quality).toBe('真品');

    expect(deriveProjectionQualityFromBudget(budget(64)).quality).toBe('真品');
    expect(deriveProjectionQualityFromBudget(budget(65)).quality).toBe('地品');

    expect(deriveProjectionQualityFromBudget(budget(89)).quality).toBe('地品');
    expect(deriveProjectionQualityFromBudget(budget(90)).quality).toBe('天品');

    expect(deriveProjectionQualityFromBudget(budget(124)).quality).toBe('天品');
    expect(deriveProjectionQualityFromBudget(budget(125)).quality).toBe('仙品');

    expect(deriveProjectionQualityFromBudget(budget(169)).quality).toBe('仙品');
    expect(deriveProjectionQualityFromBudget(budget(170)).quality).toBe('神品');
  });

  it('应透出 qualityOrder 与 basisEnergy', () => {
    const profile = deriveProjectionQualityFromBudget(budget(45));
    expect(profile.quality).toBe('真品');
    expect(profile.qualityOrder).toBe(3);
    expect(profile.basisEnergy).toBe(45);
  });
});

