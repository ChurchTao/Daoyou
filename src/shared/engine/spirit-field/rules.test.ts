import { describe, expect, it } from 'vitest';
import type { SpiritFieldPlantSnapshot } from './types';
import {
  calculateSpiritFieldGrowth,
  calculateSpiritFieldHarvestQuantity,
  createDefaultSpiritFieldPlots,
  evaluateCareAction,
  getSpiritFieldCareScore,
  getCareNeedWeights,
  getSpiritFieldQualityUpgradeChance,
  isSpiritFieldPlotUnlocked,
} from '.';

const plant: SpiritFieldPlantSnapshot = {
  id: 'test-plant',
  name: '试验灵草',
  seedName: '试验灵草灵种',
  quality: '玄品',
  element: '木',
  minRealm: '金丹',
  baseGrowthMs: 90 * 60_000,
  careSlots: 3,
  careCooldownMs: 10 * 60_000,
  description: '测试用灵植。',
  seedDescription: '青色种籽，表面有细密木纹。',
  appearance: '叶片细长，脉络泛青。',
  matureSign: '成熟时叶脉灵光凝成一线。',
  growthForm: 'herb',
  harvestPart: 'leaf',
  habitatTags: ['mountain', 'shaded'],
  careStyleTags: ['moisture-loving', 'qi-sensitive'],
  useTags: ['alchemy'],
  baseYieldMin: 3,
  baseYieldMax: 5,
};

describe('spirit field rules', () => {
  it('unlocks plots from realm and self harvest count', () => {
    expect(isSpiritFieldPlotUnlocked({ plotIndex: 0, realm: '炼气', selfHarvestCount: 0 })).toBe(true);
    expect(isSpiritFieldPlotUnlocked({ plotIndex: 1, realm: '筑基', selfHarvestCount: 49 })).toBe(false);
    expect(isSpiritFieldPlotUnlocked({ plotIndex: 1, realm: '筑基', selfHarvestCount: 50 })).toBe(true);
  });

  it('field speed bonus accelerates natural growth with a persisted plant snapshot', () => {
    const plots = createDefaultSpiritFieldPlots();
    plots[0] = {
      ...plots[0]!,
      plantId: plant.id,
      plant,
      plantedAt: new Date(0).toISOString(),
    };
    const slow = calculateSpiritFieldGrowth({ plot: plots[0]!, fieldLevel: 0, nowMs: 45 * 60_000 });
    const fast = calculateSpiritFieldGrowth({ plot: plots[0]!, fieldLevel: 4, nowMs: 45 * 60_000 });
    expect(fast.progress).toBeGreaterThan(slow.progress);
  });

  it('care grade contributes both growth acceleration and harvest score', () => {
    expect(evaluateCareAction('moisture_high', 'dry_soil')).toEqual({
      grade: 'excellent',
      boostPercent: 0.06,
      careScore: 100,
    });
    expect(evaluateCareAction('weak_growth', 'fertilize').grade).toBe('excellent');
    expect(evaluateCareAction('moisture_high', 'moisten').careScore).toBe(35);
  });


  it('seed care-style tags only bias anomaly tendency, not reward numbers', () => {
    const neutral = getCareNeedWeights({ ...plant, careStyleTags: [] });
    const sensitive = getCareNeedWeights({
      ...plant,
      careStyleTags: ['moisture-loving', 'qi-sensitive'],
    });
    expect(sensitive.moisture_low).toBeGreaterThan(neutral.moisture_low);
    expect(sensitive.qi_stagnant).toBeGreaterThan(neutral.qi_stagnant);
    expect(sensitive.weak_growth).toBe(neutral.weak_growth);
  });

  it('good care produces more yield and a higher quality-upgrade chance', () => {
    const low = createDefaultSpiritFieldPlots()[0]!;
    low.plantId = plant.id;
    low.plant = plant;
    low.plantedAt = new Date(0).toISOString();
    low.careScoreTotal = 35;
    low.careScoreCount = 1;

    const high = { ...low, careScoreTotal: 100, careScoreCount: 1 };
    expect(getSpiritFieldCareScore(high)).toBe(100);
    expect(
      calculateSpiritFieldHarvestQuantity({
        plot: high,
        fieldLevel: 3,
        mode: 'broad',
        seed: 'same',
      }),
    ).toBeGreaterThan(
      calculateSpiritFieldHarvestQuantity({
        plot: low,
        fieldLevel: 3,
        mode: 'focused',
        seed: 'same',
      }),
    );
    expect(
      getSpiritFieldQualityUpgradeChance({ careScore: 100, fieldLevel: 3, mode: 'focused' }),
    ).toBeGreaterThan(
      getSpiritFieldQualityUpgradeChance({ careScore: 35, fieldLevel: 3, mode: 'focused' }),
    );
  });
});
