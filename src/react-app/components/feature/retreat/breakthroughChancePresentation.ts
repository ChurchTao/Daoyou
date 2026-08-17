import type { BreakthroughModifiers } from '@server/utils/breakthroughCalculator';
import { format } from 'd3-format';

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

function formatPercent(value: number): string {
  return format('.1%')(value);
}

function formatSignedPercent(value: number): string {
  if (value === 0) return '+0.0%';
  return `${value > 0 ? '+' : '-'}${formatPercent(Math.abs(value))}`;
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
      value: `×${formatPercent(modifiers.realmDifficulty)}`,
      tone: getMultiplierTone(modifiers.realmDifficulty),
    });
  }
  if (modifiers.progressMultiplier !== 1) {
    factors.push({
      key: 'progress',
      label: '修为进度',
      value: `×${formatPercent(modifiers.progressMultiplier)}`,
      tone: getMultiplierTone(modifiers.progressMultiplier),
    });
  }
  if (modifiers.insightMultiplier !== 1) {
    factors.push({
      key: 'insight',
      label: '道行感悟',
      value: `×${formatPercent(modifiers.insightMultiplier)}`,
      tone: getMultiplierTone(modifiers.insightMultiplier),
    });
  }
  if (modifiers.demonPenalty !== 1) {
    factors.push({
      key: 'inner-demon',
      label: '心魔影响',
      value: `×${formatPercent(modifiers.demonPenalty)}`,
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
      value: `-${formatPercent(modifiers.toxicityPenalty)}`,
      tone: 'warning',
    });
  }

  return {
    adjustedBaseChance: modifiers.adjustedBaseChance,
    finalChance: input.finalChance ?? modifiers.finalChance,
    factors,
  };
}
