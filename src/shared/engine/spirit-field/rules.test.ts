import { describe, expect, it } from 'vitest';
import { advanceSpiritFieldPlotToDecision, createDefaultSpiritFieldPlots, getCultivationResourceCost, getSpiritFieldPlotRuntime, getStageDurationMs, settleSpiritFieldHarvest } from '.';
import type { SpiritFieldPlantSnapshot, SpiritFieldPlotState } from './types';

const plant: SpiritFieldPlantSnapshot = {
  id: 'seed-test', seedName: '青纹眠籽', seedDescription: '青灰种壳上有木纹。', clueTexts: ['遇到温和灵机时微微发热', '似乎不喜血性浇灌'],
  quality: '玄品', element: '木', minRealm: '金丹', growthForm: 'herb', harvestPart: 'leaf',
  preferredMethods: ['seasonal_nurture', 'intrinsic_infusion', 'leaf_medicine'], avoidedMethods: ['monster_blood'],
  preferredHabitats: ['shaded'], avoidedHabitats: ['volcanic'], growthTraits: ['qi-sensitive'],
  useTags: ['alchemy'], outcomeBiases: ['herb'], creationTags: ['Material.Semantic.Wood', 'Material.Semantic.Alchemy'],
  stageDurationMs: { germination: 1_000_000, nourishing: 1_000_000, forming: 1_000_000 }, baseYieldMin: 3, baseYieldMax: 5,
};

function completedPlot(scores: number[], formingMethod = 'natural_form'): SpiritFieldPlotState {
  return {
    ...createDefaultSpiritFieldPlots()[0]!, plantId: plant.id, plant, plantedAt: new Date(0).toISOString(), stageIndex: 2,
    stageStartedAt: new Date(0).toISOString(), stageEndsAt: new Date(1).toISOString(),
    history: scores.map((score, index) => ({ stage: ['germination', 'nourishing', 'forming'][index] as 'germination' | 'nourishing' | 'forming', method: (index === 2 ? formingMethod : index === 1 ? 'rest_nurture' : 'seasonal_nurture') as never, affinity: score >= 85 ? 'excellent' : score < 48 ? 'strained' : 'neutral', score, feedback: '测试反馈', completedAt: new Date(0).toISOString() })),
  };
}

describe('spirit field three-stage rules', () => {
  it('stops at every decision node instead of growing through unattended stages', () => {
    const plot = { ...createDefaultSpiritFieldPlots()[0]!, plantId: plant.id, plant, plantedAt: new Date(0).toISOString(), stageStartedAt: new Date(0).toISOString(), stageEndsAt: new Date(1).toISOString() };
    expect(getSpiritFieldPlotRuntime(plot, 2).status).toBe('awaiting_cultivation');
    const advanced = advanceSpiritFieldPlotToDecision(plot, 2);
    expect(advanced.stageIndex).toBe(1);
    expect(advanced.stageStartedAt).toBeNull();
    expect(getSpiritFieldPlotRuntime(advanced, 99_999).status).toBe('awaiting_cultivation');
  });

  it('opens every plot in the first release', () => {
    expect(createDefaultSpiritFieldPlots()).toHaveLength(6);
  });

  it('scales deterministic qi and spirit-stone costs by seed quality', () => {
    expect(getCultivationResourceCost('qi_growth', '天品').amount).toBeGreaterThan(getCultivationResourceCost('qi_growth', '凡品').amount);
    expect(getCultivationResourceCost('aux_gather', '地品').spiritStones).toBeGreaterThan(getCultivationResourceCost('aux_gather', '凡品').spiritStones);
  });

  it('makes 天地灵气 cultivation deterministically faster', () => {
    expect(getStageDurationMs(plant, 'qi_sprout', 'neutral')).toBe(750_000);
    expect(getStageDurationMs(plant, 'seasonal_nurture', 'neutral')).toBe(1_000_000);
  });

  it('uses cultivation history to settle one legal irreversible form', () => {
    const herb = settleSpiritFieldHarvest(completedPlot([100, 100, 100], 'leaf_medicine'), 'fixed-seed');
    expect(['herb', 'tcdb', 'spirit_fruit']).toContain(herb.outcomeKind);
    expect(herb.quantity).toBeGreaterThan(0);
    expect(herb.score).toBe(100);
  });

  it('never produces total failure and quality changes by at most one step', () => {
    const result = settleSpiritFieldHarvest(completedPlot([38, 38, 38]), 'degraded-seed');
    expect(result.quantity).toBeGreaterThan(0);
    expect(['灵品', '玄品']).toContain(result.quality);
  });
});
