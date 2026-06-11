import type {
  FateEffectEntry,
  FateEffectPolarity,
  FateEffectType,
} from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import {
  FATE_QUALITY_SCALE,
  FATE_ROLL_VERSION,
} from './FateConfig';

type FateValueKind =
  | 'multiplier_up'
  | 'multiplier_down'
  | 'bonus_up'
  | 'bonus_down';

export type FateEffectFamily =
  | 'retreat_exp'
  | 'retreat_insight'
  | 'breakthrough'
  | 'natural_recovery'
  | 'toxicity_penalty'
  | 'spirit_stone_cost'
  | 'enlightenment_cost'
  | 'inn_loss';

export interface FateEffectDefinition {
  id: string;
  effectType: FateEffectType;
  polarity: FateEffectPolarity;
  family: FateEffectFamily;
  weight: number;
  label: string;
  keywords: string[];
  suffix: '骨' | '台' | '命' | '体' | '心' | '脉';
  valueKind: FateValueKind;
  baseRange: readonly [number, number];
  roundingStep: number;
  buildLabel: (value: number) => string;
  buildDescription: (value: number) => string;
}

export interface FateRolledValue {
  value: number;
  minValue: number;
  maxValue: number;
  rolledPercentile: number;
  roundingStep: number;
}

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function formatPercentDelta(delta: number, fractionDigits = 0): string {
  const value = delta * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`;
}

function formatReduction(multiplier: number): string {
  return `-${((1 - multiplier) * 100).toFixed(0)}%`;
}

function formatIncrease(multiplier: number): string {
  return `+${((multiplier - 1) * 100).toFixed(0)}%`;
}

function applyScaledValue(
  base: number,
  kind: FateValueKind,
  quality: Quality,
): number {
  const scale = FATE_QUALITY_SCALE[quality];

  switch (kind) {
    case 'multiplier_up':
      return 1 + base * scale;
    case 'multiplier_down':
      return 1 - base * scale;
    case 'bonus_up':
      return base * scale;
    case 'bonus_down':
      return -base * scale;
  }
}

function rollValue(
  definition: FateEffectDefinition,
  quality: Quality,
  rng: () => number,
): FateRolledValue {
  const [baseMin, baseMax] = definition.baseRange;
  const rawMin = applyScaledValue(baseMin, definition.valueKind, quality);
  const rawMax = applyScaledValue(baseMax, definition.valueKind, quality);
  const minValue = Math.min(rawMin, rawMax);
  const maxValue = Math.max(rawMin, rawMax);
  const rolledPercentile = rng();
  const rolledValue = minValue + (maxValue - minValue) * rolledPercentile;
  const value = roundToStep(rolledValue, definition.roundingStep);

  return {
    value,
    minValue: roundToStep(minValue, definition.roundingStep),
    maxValue: roundToStep(maxValue, definition.roundingStep),
    rolledPercentile,
    roundingStep: definition.roundingStep,
  };
}

function defineEffect(
  definition: FateEffectDefinition,
): FateEffectDefinition {
  return definition;
}

const POSITIVE_EFFECTS = [
  defineEffect({
    id: 'retreat-exp-gain',
    effectType: 'retreat_exp_multiplier',
    polarity: 'boon',
    family: 'retreat_exp',
    weight: 1,
    label: '闭关修为获取提升',
    keywords: ['闭关', '苦修', '根基', '稳扎', '修为'],
    suffix: '骨',
    valueKind: 'multiplier_up',
    baseRange: [0.03, 0.06],
    roundingStep: 0.01,
    buildLabel: (value) => `闭关修为获取 ${formatPercentDelta(value - 1)}`,
    buildDescription: (value) =>
      `此人天生根骨运转更稳，闭关修为获取 ${formatPercentDelta(value - 1)}。`,
  }),
  defineEffect({
    id: 'retreat-insight-gain',
    effectType: 'retreat_insight_multiplier',
    polarity: 'boon',
    family: 'retreat_insight',
    weight: 1,
    label: '闭关感悟获取提升',
    keywords: ['感悟', '参悟', '明悟', '闭关', '神识'],
    suffix: '台',
    valueKind: 'multiplier_up',
    baseRange: [0.04, 0.08],
    roundingStep: 0.01,
    buildLabel: (value) => `闭关感悟获取 ${formatPercentDelta(value - 1)}`,
    buildDescription: (value) =>
      `此人天生心念更易澄明，闭关感悟获取 ${formatPercentDelta(value - 1)}。`,
  }),
  defineEffect({
    id: 'breakthrough-bonus',
    effectType: 'breakthrough_bonus',
    polarity: 'boon',
    family: 'breakthrough',
    weight: 0.95,
    label: '突破成功率提升',
    keywords: ['突破', '冲关', '瓶颈', '破境', '临门'],
    suffix: '命',
    valueKind: 'bonus_up',
    baseRange: [0.008, 0.015],
    roundingStep: 0.001,
    buildLabel: (value) => `突破成功率 ${formatPercentDelta(value, 1)}`,
    buildDescription: (value) =>
      `此人先天关隘略松，突破成功率 ${formatPercentDelta(value, 1)}。`,
  }),
  defineEffect({
    id: 'natural-recovery',
    effectType: 'natural_recovery_multiplier',
    polarity: 'boon',
    family: 'natural_recovery',
    weight: 1,
    label: '自然恢复效率提升',
    keywords: ['恢复', '调息', '养伤', '体魄', '续战'],
    suffix: '体',
    valueKind: 'multiplier_up',
    baseRange: [0.05, 0.1],
    roundingStep: 0.01,
    buildLabel: (value) => `自然恢复效率 ${formatPercentDelta(value - 1)}`,
    buildDescription: (value) =>
      `此人气血与法力回转更快，自然恢复效率 ${formatPercentDelta(value - 1)}。`,
  }),
  defineEffect({
    id: 'toxicity-mitigation',
    effectType: 'toxicity_penalty_multiplier',
    polarity: 'boon',
    family: 'toxicity_penalty',
    weight: 0.9,
    label: '丹毒惩罚减轻',
    keywords: ['丹毒', '调息', '解毒', '药性', '稳息'],
    suffix: '心',
    valueKind: 'multiplier_down',
    baseRange: [0.06, 0.1],
    roundingStep: 0.01,
    buildLabel: (value) => `丹毒惩罚 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人天生更能化开药力滞涩，丹毒惩罚 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'alchemy-cost-reduction',
    effectType: 'alchemy_spirit_stone_multiplier',
    polarity: 'boon',
    family: 'spirit_stone_cost',
    weight: 0.9,
    label: '炼丹灵石消耗降低',
    keywords: ['炼丹', '丹炉', '药材', '丹道', '火候'],
    suffix: '心',
    valueKind: 'multiplier_down',
    baseRange: [0.04, 0.08],
    roundingStep: 0.01,
    buildLabel: (value) => `炼丹灵石消耗 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人天生更懂顺势省力，炼丹灵石消耗 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'refine-cost-reduction',
    effectType: 'refine_spirit_stone_multiplier',
    polarity: 'boon',
    family: 'spirit_stone_cost',
    weight: 0.86,
    label: '炼器灵石消耗降低',
    keywords: ['炼器', '锻造', '铸炼', '器胚', '淬火'],
    suffix: '脉',
    valueKind: 'multiplier_down',
    baseRange: [0.03, 0.06],
    roundingStep: 0.01,
    buildLabel: (value) => `炼器灵石消耗 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人祭炼器胚时更少走弯路，炼器灵石消耗 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'enlightenment-insight-reduction',
    effectType: 'enlightenment_insight_multiplier',
    polarity: 'boon',
    family: 'enlightenment_cost',
    weight: 0.92,
    label: '参悟感悟消耗降低',
    keywords: ['参悟', '功法', '神通', '典籍', '悟道'],
    suffix: '台',
    valueKind: 'multiplier_down',
    baseRange: [0.04, 0.08],
    roundingStep: 0.01,
    buildLabel: (value) => `参悟感悟消耗 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人观理更易入门，功法与神通参悟消耗 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'inn-loss-reduction',
    effectType: 'inn_cultivation_loss_multiplier',
    polarity: 'boon',
    family: 'inn_loss',
    weight: 0.75,
    label: '灵泉疗伤修为损耗降低',
    keywords: ['灵泉', '疗伤', '养伤', '静养', '修为'],
    suffix: '脉',
    valueKind: 'multiplier_down',
    baseRange: [0.08, 0.15],
    roundingStep: 0.01,
    buildLabel: (value) => `灵泉疗伤修为损耗 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人道体更易借灵泉稳住散乱真气，疗伤修为损耗 ${formatReduction(value)}。`,
  }),
] as const satisfies readonly FateEffectDefinition[];

const NEGATIVE_EFFECTS = [
  defineEffect({
    id: 'retreat-exp-drag',
    effectType: 'retreat_exp_multiplier',
    polarity: 'burden',
    family: 'retreat_exp',
    weight: 1,
    label: '闭关修为获取下降',
    keywords: ['闭关', '滞涩', '拖慢'],
    suffix: '骨',
    valueKind: 'multiplier_down',
    baseRange: [0.02, 0.05],
    roundingStep: 0.01,
    buildLabel: (value) => `闭关修为获取 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `只是这道气数牵扯运转节奏，闭关修为获取 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'breakthrough-stumble',
    effectType: 'breakthrough_bonus',
    polarity: 'burden',
    family: 'breakthrough',
    weight: 0.95,
    label: '突破成功率下降',
    keywords: ['冲关', '失衡', '关隘'],
    suffix: '命',
    valueKind: 'bonus_down',
    baseRange: [0.005, 0.01],
    roundingStep: 0.001,
    buildLabel: (value) => `突破成功率 ${formatPercentDelta(value, 1)}`,
    buildDescription: (value) =>
      `只是临门一脚时常被气数扯偏，突破成功率 ${formatPercentDelta(value, 1)}。`,
  }),
  defineEffect({
    id: 'natural-recovery-drag',
    effectType: 'natural_recovery_multiplier',
    polarity: 'burden',
    family: 'natural_recovery',
    weight: 1,
    label: '自然恢复效率下降',
    keywords: ['养伤', '恢复', '迟缓'],
    suffix: '体',
    valueKind: 'multiplier_down',
    baseRange: [0.04, 0.08],
    roundingStep: 0.01,
    buildLabel: (value) => `自然恢复效率 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `只是气血回转偏慢，自然恢复效率 ${formatReduction(value)}。`,
  }),
  defineEffect({
    id: 'toxicity-burden',
    effectType: 'toxicity_penalty_multiplier',
    polarity: 'burden',
    family: 'toxicity_penalty',
    weight: 0.9,
    label: '丹毒惩罚加深',
    keywords: ['丹毒', '药性', '反噬'],
    suffix: '心',
    valueKind: 'multiplier_up',
    baseRange: [0.05, 0.1],
    roundingStep: 0.01,
    buildLabel: (value) => `丹毒惩罚 ${formatIncrease(value)}`,
    buildDescription: (value) =>
      `只是药力滞涩更易沉积，丹毒惩罚 ${formatIncrease(value)}。`,
  }),
  defineEffect({
    id: 'system-spirit-stone-surcharge',
    effectType: 'system_spirit_stone_multiplier',
    polarity: 'burden',
    family: 'spirit_stone_cost',
    weight: 0.88,
    label: '系统养成灵石消耗上升',
    keywords: ['耗费', '破财', '费石'],
    suffix: '脉',
    valueKind: 'multiplier_up',
    baseRange: [0.04, 0.08],
    roundingStep: 0.01,
    buildLabel: (value) => `系统养成灵石消耗 ${formatIncrease(value)}`,
    buildDescription: (value) =>
      `只是每逢祭炼与调养总要多费灵石，系统养成灵石消耗 ${formatIncrease(value)}。`,
  }),
] as const satisfies readonly FateEffectDefinition[];

export function getPositiveFateEffects(): FateEffectDefinition[] {
  return [...POSITIVE_EFFECTS];
}

export function getNegativeFateEffects(): FateEffectDefinition[] {
  return [...NEGATIVE_EFFECTS];
}

export function buildFateEffectEntry(
  definition: FateEffectDefinition,
  quality: Quality,
  rng: () => number,
): FateEffectEntry {
  const rolled = rollValue(definition, quality, rng);

  return {
    id: `${definition.id}:${quality}:${rolled.rolledPercentile.toFixed(6)}`,
    effectId: definition.id,
    scope: definition.polarity === 'boon' ? 'daily' : 'drawback',
    polarity: definition.polarity,
    effectType: definition.effectType,
    value: rolled.value,
    label: definition.buildLabel(rolled.value),
    description: definition.buildDescription(rolled.value),
    rollMeta: {
      qualityAnchor: quality,
      minValue: rolled.minValue,
      maxValue: rolled.maxValue,
      rolledPercentile: rolled.rolledPercentile,
      roundingStep: rolled.roundingStep,
    },
  };
}

const FALLBACK_NAME_STEMS: Record<string, string> = {
  'retreat-exp-gain': '藏息骨',
  'retreat-insight-gain': '澄照台',
  'breakthrough-bonus': '通关命',
  'natural-recovery': '回澜体',
  'toxicity-mitigation': '和药心',
  'alchemy-cost-reduction': '温炉心',
  'refine-cost-reduction': '省炼脉',
  'enlightenment-insight-reduction': '照悟台',
  'inn-loss-reduction': '守藏脉',
  'retreat-exp-drag': '滞修骨',
  'breakthrough-stumble': '厄关命',
  'natural-recovery-drag': '迟息体',
  'toxicity-burden': '郁毒心',
  'system-spirit-stone-surcharge': '耗石脉',
};

export function buildFallbackFateName(
  definition: FateEffectDefinition,
  quality: Quality,
): string {
  return `${quality}${FALLBACK_NAME_STEMS[definition.id] ?? '命格相'}`;
}

export function buildFallbackFateDescription(
  effects: FateEffectEntry[],
): string {
  const [primary, burden] = effects;
  if (!primary) {
    return '此人命数未明，气机流转尚无定性。';
  }
  if (!burden) {
    return `此人天生${primary.description.replace(/。$/, '')}`;
  }
  return `${primary.description}${burden.description}`;
}

export function summarizeFateAura(effects: FateEffectEntry[]): string {
  const positives = effects
    .filter((effect) => effect.polarity === 'boon')
    .map((effect) => effect.label);
  const burdens = effects
    .filter((effect) => effect.polarity === 'burden')
    .map((effect) => effect.label);

  return [
    positives.length > 0 ? `顺势：${positives.join('，')}` : undefined,
    burdens.length > 0 ? `代价：${burdens.join('，')}` : undefined,
  ]
    .filter(Boolean)
    .join('；');
}

export function isHighQualityFate(quality: Quality): boolean {
  return QUALITY_ORDER[quality] >= QUALITY_ORDER['天品'];
}

export function getFateRollVersion(): string {
  return FATE_ROLL_VERSION;
}
