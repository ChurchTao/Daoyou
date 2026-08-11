import type { FateEffectType } from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';
import type {
  FateEffectDefinition,
  FateEffectFamily,
} from './FateFragmentRegistry';

const HERB_GROWTH_EFFECT = 'herb_growth_time_multiplier' as FateEffectType;
const HERB_YIELD_EFFECT = 'herb_yield_multiplier' as FateEffectType;
const HERB_MUTATION_EFFECT = 'herb_mutation_bonus' as FateEffectType;
const HERB_SEED_RETURN_EFFECT = 'herb_seed_return_bonus' as FateEffectType;

const HERB_GROWTH_FAMILY = 'herb_growth' as FateEffectFamily;
const HERB_YIELD_FAMILY = 'herb_yield' as FateEffectFamily;
const HERB_MUTATION_FAMILY = 'herb_mutation' as FateEffectFamily;
const HERB_SEED_FAMILY = 'herb_seed' as FateEffectFamily;

function percentDelta(value: number, digits = 0): string {
  const percent = value * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(digits)}%`;
}

function reduction(multiplier: number): string {
  return `-${((1 - multiplier) * 100).toFixed(0)}%`;
}

const HERB_FATE_EFFECTS: readonly FateEffectDefinition[] = [
  {
    id: 'herb-growth-affinity',
    effectType: HERB_GROWTH_EFFECT,
    polarity: 'boon',
    family: HERB_GROWTH_FAMILY,
    weight: 0.72,
    label: '灵植生长加速',
    keywords: ['草木', '灵植', '药田', '生机', '培育'],
    suffix: '心',
    valueKind: 'multiplier_down',
    baseRange: [0.012, 0.022],
    roundingStep: 0.01,
    buildLabel: (value) => `灵植成熟时间 ${reduction(value)}`,
    buildDescription: (value) =>
      `此人与草木生机天然亲近，灵植成熟时间 ${reduction(value)}。`,
  },
  {
    id: 'herb-yield-affinity',
    effectType: HERB_YIELD_EFFECT,
    polarity: 'boon',
    family: HERB_YIELD_FAMILY,
    weight: 0.5,
    label: '灵药丰产',
    keywords: ['丰收', '灵药', '厚土', '药田', '培育'],
    suffix: '脉',
    valueKind: 'multiplier_up',
    baseRange: [0.008, 0.015],
    roundingStep: 0.01,
    buildLabel: (value) => `灵药基础产量 ${percentDelta(value - 1)}`,
    buildDescription: (value) =>
      `此人培育灵药时更易保全药性与株数，基础产量 ${percentDelta(value - 1)}。`,
  },
  {
    id: 'herb-mutation-affinity',
    effectType: HERB_MUTATION_EFFECT,
    polarity: 'boon',
    family: HERB_MUTATION_FAMILY,
    weight: 0.58,
    label: '灵植灵变提升',
    keywords: ['灵变', '异变', '造化', '草木', '机缘'],
    suffix: '命',
    valueKind: 'bonus_up',
    baseRange: [0.001, 0.002],
    roundingStep: 0.001,
    buildLabel: (value) => `灵植灵变概率 ${percentDelta(value, 1)}`,
    buildDescription: (value) =>
      `此人身侧草木更易撞见一线造化，灵植灵变概率 ${percentDelta(value, 1)}。`,
  },
  {
    id: 'herb-seed-affinity',
    effectType: HERB_SEED_RETURN_EFFECT,
    polarity: 'boon',
    family: HERB_SEED_FAMILY,
    weight: 0.56,
    label: '灵种留存提升',
    keywords: ['留种', '灵种', '薪火', '培育', '草木'],
    suffix: '心',
    valueKind: 'bonus_up',
    baseRange: [0.01, 0.02],
    roundingStep: 0.01,
    buildLabel: (value) => `收获留种概率 ${percentDelta(value)}`,
    buildDescription: (value) =>
      `此人更懂草木荣枯循环，收获时留存灵种的概率 ${percentDelta(value)}。`,
  },
];

const HERB_FATE_NAMES: Record<string, readonly string[]> = {
  'herb-growth-affinity': [
    '草木有缘',
    '青苗亲和',
    '草木灵心',
    '青木灵心',
    '百草朝生',
    '万木朝生',
    '青帝灵心',
    '青帝遗泽',
  ],
  'herb-yield-affinity': [
    '土生百草',
    '沃土之缘',
    '丰泽药脉',
    '厚土灵脉',
    '五谷丰灵',
    '厚土丰泽',
    '息壤药脉',
    '万物丰生',
  ],
  'herb-mutation-affinity': [
    '偶得灵机',
    '草木奇缘',
    '灵植易变',
    '造化草心',
    '万物化生',
    '造化灵机',
    '万象化生',
    '造化本源',
  ],
  'herb-seed-affinity': [
    '草籽常留',
    '薪芽不绝',
    '灵种有缘',
    '薪火灵心',
    '百草留薪',
    '薪火不绝',
    '万世留种',
    '生生不息',
  ],
};

const QUALITY_INDEX: Record<Quality, number> = {
  凡品: 0,
  灵品: 1,
  玄品: 2,
  真品: 3,
  地品: 4,
  天品: 5,
  仙品: 6,
  神品: 7,
};

export function getHerbPositiveFateEffects(): FateEffectDefinition[] {
  return [...HERB_FATE_EFFECTS];
}

export function getHerbFateName(effectId: string, quality: Quality): string | undefined {
  return HERB_FATE_NAMES[effectId]?.[QUALITY_INDEX[quality]];
}
