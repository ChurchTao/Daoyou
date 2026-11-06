import { formatRatioPercent } from '@daoyou/game-rules/presentation/numbers';
import type { BreakthroughModifiers } from '@daoyou/game-domain/cultivation';

export type BreakthroughFactorTone = 'positive' | 'warning' | 'neutral';

export interface BreakthroughChanceFactor {
  key: string;
  label: string;
  value: string;
  tone: BreakthroughFactorTone;
}

export interface BreakthroughChancePresentation {
  adjustedBaseChance: number;
  finalChance: number;
  factors: BreakthroughChanceFactor[];
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? '+' : '-'}${formatRatioPercent(Math.abs(value), 1)}`;
}

function getDeltaTone(value: number): BreakthroughFactorTone {
  if (value > 0) return 'positive';
  if (value < 0) return 'warning';
  return 'neutral';
}

function getMultiplierTone(value: number): BreakthroughFactorTone {
  if (value > 1) return 'positive';
  if (value < 1) return 'warning';
  return 'neutral';
}

export function buildBreakthroughChancePresentation(input: {
  modifiers: BreakthroughModifiers;
  finalChance?: number;
}): BreakthroughChancePresentation {
  const { modifiers } = input;
  const factors: BreakthroughChanceFactor[] = [];

  if (modifiers.realmDifficulty !== 1) {
    factors.push({
      key: 'realm',
      label: '境界难度',
      value: `×${formatRatioPercent(modifiers.realmDifficulty, 1)}`,
      tone: getMultiplierTone(modifiers.realmDifficulty),
    });
  }
  if (modifiers.progressMultiplier !== 1) {
    factors.push({
      key: 'progress',
      label: '修为进度',
      value: `×${formatRatioPercent(modifiers.progressMultiplier, 1)}`,
      tone: getMultiplierTone(modifiers.progressMultiplier),
    });
  }
  if (modifiers.insightMultiplier !== 1) {
    factors.push({
      key: 'insight',
      label: '道行感悟',
      value: `×${formatRatioPercent(modifiers.insightMultiplier, 1)}`,
      tone: getMultiplierTone(modifiers.insightMultiplier),
    });
  }
  if (modifiers.demonPenalty !== 1) {
    factors.push({
      key: 'inner-demon',
      label: '心魔影响',
      value: `×${formatRatioPercent(modifiers.demonPenalty, 1)}`,
      tone: getMultiplierTone(modifiers.demonPenalty),
    });
  }
  if (modifiers.fateBonus !== 0) {
    factors.push({
      key: 'fate',
      label: '命格机缘',
      value: formatSignedPercent(modifiers.fateBonus),
      tone: getDeltaTone(modifiers.fateBonus),
    });
  }
  if (modifiers.pillBonus !== 0) {
    factors.push({
      key: 'pill',
      label: '破境药力',
      value: formatSignedPercent(modifiers.pillBonus),
      tone: getDeltaTone(modifiers.pillBonus),
    });
  }
  if (modifiers.toxicityPenalty !== 0) {
    factors.push({
      key: 'toxicity',
      label: '丹毒惩罚',
      value: `-${formatRatioPercent(modifiers.toxicityPenalty, 1)}`,
      tone: 'warning',
    });
  }

  return {
    adjustedBaseChance: modifiers.adjustedBaseChance,
    finalChance: input.finalChance ?? modifiers.finalChance,
    factors,
  };
}
