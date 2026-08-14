import type { Quality } from '@shared/types/constants';

export interface AlchemyEffectQualityBase {
  restorePercent: number;
  detox: number;
  cultivationBoost: number;
  insight: number;
  lifespan: number;
  bodyTrack: number;
  protectMeridians: number;
  breakthroughFocus: number;
  clearMindUses: number;
  healingTier: 1 | 2 | 3;
  positiveToxicity: number;
}

/** v4 炼丹的唯一品质基础表。 */
export const ALCHEMY_EFFECT_BASE_BY_QUALITY: Record<
  Quality,
  AlchemyEffectQualityBase
> = {
  凡品: {
    restorePercent: 0.12,
    detox: 12,
    cultivationBoost: 0.4,
    insight: 2,
    lifespan: 10,
    bodyTrack: 40,
    protectMeridians: 0.15,
    breakthroughFocus: 0.02,
    clearMindUses: 1,
    healingTier: 1,
    positiveToxicity: 40,
  },
  灵品: {
    restorePercent: 0.2,
    detox: 24,
    cultivationBoost: 0.7,
    insight: 4,
    lifespan: 25,
    bodyTrack: 70,
    protectMeridians: 0.25,
    breakthroughFocus: 0.04,
    clearMindUses: 1,
    healingTier: 1,
    positiveToxicity: 35,
  },
  玄品: {
    restorePercent: 0.3,
    detox: 45,
    cultivationBoost: 1.2,
    insight: 8,
    lifespan: 60,
    bodyTrack: 120,
    protectMeridians: 0.38,
    breakthroughFocus: 0.07,
    clearMindUses: 2,
    healingTier: 1,
    positiveToxicity: 30,
  },
  真品: {
    restorePercent: 0.42,
    detox: 80,
    cultivationBoost: 2,
    insight: 15,
    lifespan: 140,
    bodyTrack: 200,
    protectMeridians: 0.52,
    breakthroughFocus: 0.11,
    clearMindUses: 2,
    healingTier: 1,
    positiveToxicity: 25,
  },
  地品: {
    restorePercent: 0.56,
    detox: 140,
    cultivationBoost: 3.2,
    insight: 26,
    lifespan: 300,
    bodyTrack: 320,
    protectMeridians: 0.66,
    breakthroughFocus: 0.16,
    clearMindUses: 2,
    healingTier: 2,
    positiveToxicity: 20,
  },
  天品: {
    restorePercent: 0.7,
    detox: 230,
    cultivationBoost: 4.5,
    insight: 42,
    lifespan: 600,
    bodyTrack: 500,
    protectMeridians: 0.78,
    breakthroughFocus: 0.21,
    clearMindUses: 3,
    healingTier: 3,
    positiveToxicity: 15,
  },
  仙品: {
    restorePercent: 0.85,
    detox: 380,
    cultivationBoost: 6,
    insight: 65,
    lifespan: 1200,
    bodyTrack: 750,
    protectMeridians: 0.88,
    breakthroughFocus: 0.26,
    clearMindUses: 3,
    healingTier: 3,
    positiveToxicity: 10,
  },
  神品: {
    restorePercent: 1,
    detox: 600,
    cultivationBoost: 8,
    insight: 100,
    lifespan: 2400,
    bodyTrack: 1100,
    protectMeridians: 1,
    breakthroughFocus: 0.3,
    clearMindUses: 4,
    healingTier: 3,
    positiveToxicity: 5,
  },
};
