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
  | 'market_purchase'
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
    id: 'market-purchase-discount',
    effectType: 'market_purchase_price_multiplier',
    polarity: 'boon',
    family: 'market_purchase',
    weight: 0.9,
    label: '坊市购买价格降低',
    keywords: ['坊市', '交易', '议价', '买卖', '折价'],
    suffix: '命',
    valueKind: 'multiplier_down',
    baseRange: [0.03, 0.07],
    roundingStep: 0.01,
    buildLabel: (value) => `坊市购买价格 ${formatReduction(value)}`,
    buildDescription: (value) =>
      `此人天生善察市价起落，坊市购买价格 ${formatReduction(value)}。`,
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

export interface FateTextPreset {
  name: string;
  descriptionTemplate: string;
}

export type FateTextPresetRegistry = Record<
  string,
  Record<Quality, FateTextPreset>
>;

export const FATE_TEXT_PRESETS: FateTextPresetRegistry = {
  'retreat-exp-gain': {
    凡品: { name: '勤修骨', descriptionTemplate: '根骨不显异象，却耐得住长久吐纳，闭关时每一缕灵气都肯慢慢沉入丹田。' },
    灵品: { name: '藏息体', descriptionTemplate: '气息入体后不易散失，像浅井蓄泉，闭关越久，越能看出积累的好处。' },
    玄品: { name: '九息服气', descriptionTemplate: '呼吸之间能牵引天地灵机，虽未到无师自通的地步，闭关修行已比常人顺畅许多。' },
    真品: { name: '龙虎之躯', descriptionTemplate: '气血与真息相互托举，静坐时如龙虎盘踞，修为增长自有一股厚劲。' },
    地品: { name: '人仙体', descriptionTemplate: '肉身与灵机亲和，闭关时精气神同涨，修为不再只靠苦熬时日。' },
    天品: { name: '先天道胎', descriptionTemplate: '天生近道，吐纳时像被大道牵引，寻常闭关也能化作稳固的进境。' },
    仙品: { name: '鸿蒙道体', descriptionTemplate: '体内似有一缕鸿蒙紫意，万般灵机入身皆能归于根基，修行路上少走旁门。' },
    神品: { name: '混沌体', descriptionTemplate: '身具混沌气象，灵机入体便可演化诸般根本，闭关所得常如开天辟地般厚重。' },
  },
  'retreat-insight-gain': {
    凡品: { name: '慧根初醒', descriptionTemplate: '心中一点慧根初醒，读经参坐时常能比旁人多明白半句。' },
    灵品: { name: '过目不忘', descriptionTemplate: '经文入眼便不易散失，旧日所学会在闭关时自行串联成新的领悟。' },
    玄品: { name: '天生慧根', descriptionTemplate: '生来对法理格外敏锐，许多晦涩关节只需静坐片刻便能摸到门径。' },
    真品: { name: '七窍玲珑心', descriptionTemplate: '心窍玲珑，能听见万物运行中的细响，闭关感悟常从旁人忽略处生出。' },
    地品: { name: '先天道体', descriptionTemplate: '与道天然相亲，法理不再隔着重雾，参悟时常有水到渠成之感。' },
    天品: { name: '醍醐灌顶', descriptionTemplate: '识海如受无上智慧灌注，疑难落入心中，往往会自行显出清楚脉络。' },
    仙品: { name: '大帝之姿', descriptionTemplate: '一眼可见功法骨架，一念能明神通关节，闭关所得感悟远非寻常悟性可比。' },
    神品: { name: '天生圣人', descriptionTemplate: '集天地大运而生，万事万物一看便会，一学便精，悟道如饮水般自然。' },
  },
  'breakthrough-bonus': {
    凡品: { name: '龙鲤入命', descriptionTemplate: '鲤鱼也有化龙之心，此命虽浅，却已得下场争关破境的资格。' },
    灵品: { name: '逢关有路', descriptionTemplate: '每遇瓶颈，命中总会留出一条不甚显眼的小路，足够临门借力。' },
    玄品: { name: '潜龙命格', descriptionTemplate: '潜龙未出渊，气数已先动；破境时常能在险处寻到回旋。' },
    真品: { name: '天命之人', descriptionTemplate: '身负天命，每逢绝境总有一线生机递到手边，冲关时尤其明显。' },
    地品: { name: '紫微星命', descriptionTemplate: '帝星入命，诸关虽险，却难完全压住此人向上之势。' },
    天品: { name: '先天鸿运', descriptionTemplate: '得天地独钟，为纪元所偏爱，破境时劫难常会先让三分。' },
    仙品: { name: '鸿蒙紫气', descriptionTemplate: '一缕成道之基护住命关，冲击大境时仿佛手握天道默许。' },
    神品: { name: '气运本源', descriptionTemplate: '此命已非顺应天命，而是自为天命；关隘当前，也要被其强行烙出通路。' },
  },
  'natural-recovery': {
    凡品: { name: '身强体壮', descriptionTemplate: '筋骨厚实，气血耐耗，伤后恢复虽不惊人，却总比常人稳一些。' },
    灵品: { name: '龙精虎猛', descriptionTemplate: '精气充沛，气血回转有龙虎之势，寻常损耗很难久拖不复。' },
    玄品: { name: '厚土之体', descriptionTemplate: '肉身如厚土养根，受创后不急不躁，却能一点点把亏空补回来。' },
    真品: { name: '金身不灭体', descriptionTemplate: '筋骨带有不灭金意，伤势落身后难以深扎，气血也更容易重新鼓荡。' },
    地品: { name: '万古不朽体', descriptionTemplate: '肉身有历劫不朽之相，越是重伤，越能看出深处生机绵长。' },
    天品: { name: '涅槃之体', descriptionTemplate: '衰败之中自含重燃之机，气血与法力常能从低谷处重新生发。' },
    仙品: { name: '永恒仙体', descriptionTemplate: '身中有近乎永恒的生机流转，伤势难以长久截断其恢复。' },
    神品: { name: '生死轮回体', descriptionTemplate: '掌一线生死轮回之意，败落可返盛，枯竭可回春，恢复之势近乎逆转生死。' },
  },
  'toxicity-mitigation': {
    凡品: { name: '清肝命', descriptionTemplate: '肝气清正，能化去一部分药性浊滞，服丹后少些沉毒牵缠。' },
    灵品: { name: '百毒不侵', descriptionTemplate: '肉身自带净毒之能，丹毒入体后也会被慢慢排出经脉。' },
    玄品: { name: '乙木之体', descriptionTemplate: '乙木生机善解郁滞，药毒虽烈，也会被草木之气一点点消磨。' },
    真品: { name: '琉璃药心', descriptionTemplate: '心如琉璃照见药性清浊，清者留，浊者散，烈丹入体也难深伤根基。' },
    地品: { name: '造化神体', descriptionTemplate: '体内造化之力能重整药性，毒与药之间不再全由丹力摆布。' },
    天品: { name: '万毒不侵体', descriptionTemplate: '万毒难侵其身，反可被炼作资粮，丹毒落入体内也多半成不了大患。' },
    仙品: { name: '玄黄之体', descriptionTemplate: '玄黄气沉厚而清浊自分，药毒入身，如污水入大地，终会被镇化。' },
    神品: { name: '造化仙胎', descriptionTemplate: '体内自孕造化仙机，丹毒尚未成患，便被改易成可承受的药力余韵。' },
  },
  'alchemy-cost-reduction': {
    凡品: { name: '惜火手', descriptionTemplate: '开炉时懂得惜火省力，几枚灵石也要用到真正该用的火候上。' },
    灵品: { name: '妙手偶得', descriptionTemplate: '灵丹妙药常能信手调和，炼丹时少走许多白白耗费的弯路。' },
    玄品: { name: '丹火亲和', descriptionTemplate: '与丹火相性极佳，火候一起便知进退，灵石消耗自然轻了许多。' },
    真品: { name: '南冥离火体', descriptionTemplate: '离火入命，善炼万药，炉中火力更听驱使，不必靠堆砌灵石强催。' },
    地品: { name: '丹王命格', descriptionTemplate: '命中与丹道有缘，药材、火候、灵石三者常能合在最省力的位置。' },
    天品: { name: '无垢丹心', descriptionTemplate: '丹心无垢，杂火杂念皆少，灵石多化为药力，少化为虚烟。' },
    仙品: { name: '太初丹体', descriptionTemplate: '丹道气象近于太初，炉火一起便归本源，炼成一炉丹所需耗费大减。' },
    神品: { name: '造化丹胎', descriptionTemplate: '身如造化丹胎，万药入炉皆能顺势成形，炼丹几乎不需用灵石硬推。' },
  },
  'refine-cost-reduction': {
    凡品: { name: '拙锤手', descriptionTemplate: '锤法看似朴拙，却少有虚敲，炼器时常能省下一些无谓火耗。' },
    灵品: { name: '顺金骨', descriptionTemplate: '金火入手较顺，器胚哪里该受力，往往能先一步察觉。' },
    玄品: { name: '庚金之体', descriptionTemplate: '天生亲近金铁，炼器时器胚回应更快，灵石不必浪费在反复校正上。' },
    真品: { name: '折金藏锋', descriptionTemplate: '懂得藏锋，不把灵石浪费在声势上，只送入器胚真正要害。' },
    地品: { name: '神印王体', descriptionTemplate: '身具神印之相，炼器时符纹与器胚更易相合，成器代价自然降低。' },
    天品: { name: '玄黄器骨', descriptionTemplate: '骨中玄黄气厚重，最善承载器道法则，铸炼时少有无谓损耗。' },
    仙品: { name: '鸿蒙铸身', descriptionTemplate: '一身鸿蒙气象可化万器之基，炼器时火、金、纹三者皆更容易归位。' },
    神品: { name: '混沌器胎', descriptionTemplate: '混沌之中可演万器，器胚落到手里便像找到了源头，所需灵石大幅减少。' },
  },
  'market-purchase-discount': {
    凡品: { name: '听价耳', descriptionTemplate: '摊前几句闲谈，便能听出价钱虚实，不至被掌柜随口抬价。' },
    灵品: { name: '青囊眼', descriptionTemplate: '买物时眼光清亮，货色好坏、价钱高低，总能比旁人多看出一层。' },
    玄品: { name: '奇货可居', descriptionTemplate: '天生会在坊市里发现被低估的货色，真正值钱的东西往往能以合适价格入手。' },
    真品: { name: '聚宝命格', descriptionTemplate: '财气聚而不滞，入坊市时常能碰见合适货色，也能谈出合适价钱。' },
    地品: { name: '紫微财星', descriptionTemplate: '帝星余辉照入财帛，商贩见之也愿让利三分，买物少费灵石。' },
    天品: { name: '点金慧眸', descriptionTemplate: '慧眸能看穿货价浮沫，不被虚价遮眼，灵石自然少花在虚处。' },
    仙品: { name: '袖里乾坤', descriptionTemplate: '袖中似另有乾坤账本，珍货当前，也常能把价钱谈回命数认可的分寸。' },
    神品: { name: '招财道运', descriptionTemplate: '财运近乎自成一条大道，连市井交易也会被轻轻推向对他有利的一端。' },
  },
  'enlightenment-insight-reduction': {
    凡品: { name: '点墨心', descriptionTemplate: '读法时不必满纸涂改，偶有一点墨落，便能顺出一小段理路。' },
    灵品: { name: '照简明心', descriptionTemplate: '看过的经文不易散失，参悟时少费许多反复翻检的心力。' },
    玄品: { name: '开卷生悟', descriptionTemplate: '慧根自生，功法神通的门径对他不算全然隐晦，参悟耗费也随之减轻。' },
    真品: { name: '玲珑道心', descriptionTemplate: '心有玲珑之相，能把繁复法理拆成可循的细线，参悟时少走死路。' },
    地品: { name: '近道之体', descriptionTemplate: '与道相亲，功法未尽开而理已先露，许多消耗都省在入门之前。' },
    天品: { name: '重瞳', descriptionTemplate: '重瞳炽盛，可洞悉本源，法诀破绽与关窍在眼中纤毫毕现。' },
    仙品: { name: '道心通明', descriptionTemplate: '任何功法一眼可见脉络，任何神通一念能明关窍，参悟成本自然远低于常人。' },
    神品: { name: '言出法随', descriptionTemplate: '口含天宪，字句近乎天规律法；参悟法门时，法理反像主动顺从其意。' },
  },
  'inn-loss-reduction': {
    凡品: { name: '抱元守一', descriptionTemplate: '疗伤时能守住一口元气，不让灵泉把修为根底一并冲散。' },
    灵品: { name: '藏珠身', descriptionTemplate: '修为像珠藏蚌中，疗伤的水流过后，仍能留下不少光泽。' },
    玄品: { name: '守藏命格', descriptionTemplate: '命中善守根本，外力疗伤时也会先护住自身修为。' },
    真品: { name: '归元井', descriptionTemplate: '体内仿佛有一口归元深井，灵泉冲刷时，散去的元气常会绕回井中。' },
    地品: { name: '万寿无疆', descriptionTemplate: '与天常在，与道长存，疗伤虽借外力，却不轻易损及寿元般的根基。' },
    天品: { name: '不漏冥王体', descriptionTemplate: '衰败与创伤难以真正夺走其根本，灵泉疗伤时修为流失也被压到更低。' },
    仙品: { name: '轮回守藏', descriptionTemplate: '轮回之意护住盛衰转换，疗伤带走的修为常会在体内转圜而回。' },
    神品: { name: '永恒命基', descriptionTemplate: '体内有近乎永恒的根基镇守，灵泉可洗伤，却难洗走真正属于他的修为。' },
  },
  'retreat-exp-drag': {
    凡品: { name: '尘锁骨', descriptionTemplate: '根骨像蒙着薄尘，闭关时气息能行，却总差一点清爽。' },
    灵品: { name: '冷灰炉', descriptionTemplate: '炉中有火也有冷灰，苦修所得常被那层灰气压慢。' },
    玄品: { name: '闭山命', descriptionTemplate: '山门太重，能护住内息，也会挡住一部分修为进境。' },
    真品: { name: '绝灵根', descriptionTemplate: '灵机近身时常被无形隔开，闭关虽能前行，却比旁人更费时日。' },
    地品: { name: '寂灭道体', descriptionTemplate: '寂灭之意盘踞体内，万物生机入身先衰三分，修为增长因此受阻。' },
    天品: { name: '十绝闭脉体', descriptionTemplate: '十绝并非全是锋芒，也会断绝部分修行通路，闭关进境常被自身格局拖慢。' },
    仙品: { name: '虚空体', descriptionTemplate: '身与虚空过近，灵气入体后容易散入空处，苦修所得难以完全留存。' },
    神品: { name: '孤星绝运', descriptionTemplate: '命犯天煞，连天地灵机也不愿久伴身侧，闭关所得常被孤煞之气削去一截。' },
  },
  'breakthrough-stumble': {
    凡品: { name: '绊石劫', descriptionTemplate: '命路上总有小石绊脚，平时无碍，临门破境时却格外讨厌。' },
    灵品: { name: '雾关命格', descriptionTemplate: '关前多雾，明明路在眼前，也容易因一念不清而错失时机。' },
    玄品: { name: '折渡命格', descriptionTemplate: '能见渡口，却常在登舟时生出一折，冲关不免多险。' },
    真品: { name: '颠覆命格', descriptionTemplate: '此为命理中的小人之变，善吸附、渗透、转化，也最易在关口处颠覆原本走势。' },
    地品: { name: '天煞关星', descriptionTemplate: '孤煞入命，越是临近大关，越容易因命数牵扯而生出额外阻力。' },
    天品: { name: '十绝关体', descriptionTemplate: '体内十绝之势会在破境时互相牵制，稍有不慎，便从助力化作关隘。' },
    仙品: { name: '逆命劫', descriptionTemplate: '命数与境界相冲，破境不像顺流而上，更像强行逆夺一线天机。' },
    神品: { name: '气运反噬', descriptionTemplate: '气运太盛而自生反噬，每逢大关，天地都要先向此人讨回一笔旧账。' },
  },
  'natural-recovery-drag': {
    凡品: { name: '薄霜身', descriptionTemplate: '气血表面像覆着薄霜，伤后能回暖，只是总慢一拍。' },
    灵品: { name: '寒叶体', descriptionTemplate: '此身有寒叶之象，生机未绝，却不容易立刻舒展。' },
    玄品: { name: '幽寒古体', descriptionTemplate: '寒意入骨，肉身洁而难温，恢复之势常被清寒拖住。' },
    真品: { name: '冰封王体', descriptionTemplate: '冰封之力镇住气血，也镇住生机，伤势恢复往往比旁人迟缓。' },
    地品: { name: '寂灭寒身', descriptionTemplate: '寂灭气息压住复苏之机，越是伤重，越难立刻唤醒生机。' },
    天品: { name: '冥王冻体', descriptionTemplate: '此体近死而不死，却也常在冥寂中久留，恢复起来并不轻快。' },
    仙品: { name: '轮回迟滞', descriptionTemplate: '盛衰转换被轮回之力拖慢，伤后明明能复原，却总要多绕一圈。' },
    神品: { name: '永恒冻土', descriptionTemplate: '永恒之意化作冻土封住肉身，生机尚在，却很难迅速破土而出。' },
  },
  'toxicity-burden': {
    凡品: { name: '苦舌根', descriptionTemplate: '药入口中先成苦意，入体后也容易留下不肯散的余毒。' },
    灵品: { name: '浊壶命', descriptionTemplate: '此命如旧壶盛新酒，药性越多，浊味越不容易洗净。' },
    玄品: { name: '蚀药骨', descriptionTemplate: '药力越杂，越可能在经脉里留下暗刺，像细虫慢慢啮骨。' },
    真品: { name: '万厄毒胎', descriptionTemplate: '万毒皆可入身，却未必都能为己所用；丹药越烈，反噬越深。' },
    地品: { name: '幽冥之体', descriptionTemplate: '幽冥阴气善藏沉毒，药力入体后常往暗处沉积，久了便成深患。' },
    天品: { name: '吞毒之体', descriptionTemplate: '吞噬之力不分清浊，药力与丹毒一并卷入体内，反使毒性更难排出。' },
    仙品: { name: '寂灭毒胎', descriptionTemplate: '毒性入体后被寂灭气息养得更深，短时不显，爆发时却更难收拾。' },
    神品: { name: '饮鸩命格', descriptionTemplate: '得力越快，反噬越狠；此命纳药极深，也纳毒极深。' },
  },
  'system-spirit-stone-surcharge': {
    凡品: { name: '漏财命', descriptionTemplate: '灵石到了他手里不是留不住，而是修行途中总会多漏几枚。' },
    灵品: { name: '破盏财', descriptionTemplate: '如破盏盛水，调养祭炼都容易生出额外耗费。' },
    玄品: { name: '吞金化石', descriptionTemplate: '消化外物的本事太强，灵石投入修行后常被额外吞去一截。' },
    真品: { name: '沉债命格', descriptionTemplate: '修行像背着旧债，凡需灵石处，总要多还一点给命数。' },
    地品: { name: '耗财命格', descriptionTemplate: '此格善吸附与转化，连投入养成的灵石也容易被旁支细节吸走。' },
    天品: { name: '吞金之体', descriptionTemplate: '吞噬之力索求无度，祭炼、调养、参悟皆要先被它分去一份灵石。' },
    仙品: { name: '鬼王体', descriptionTemplate: '鬼王之体清贵难养，借外物成事时，代价往往比旁人更重。' },
    神品: { name: '气运黑洞', descriptionTemplate: '命中似有无底黑洞，投向修行系统的灵石，总要先被气运吞去一口。' },
  },
} as const satisfies FateTextPresetRegistry;

export function getFateTextPreset(
  definition: FateEffectDefinition,
  quality: Quality,
): FateTextPreset {
  return (
    FATE_TEXT_PRESETS[definition.id]?.[quality] ?? {
      name: '未明命格',
      descriptionTemplate: '{effectDescription}。',
    }
  );
}

export function buildFallbackFateName(
  definition: FateEffectDefinition,
  quality: Quality,
): string {
  return getFateTextPreset(definition, quality).name;
}

export function buildFallbackFateDescription(
  effects: FateEffectEntry[],
): string {
  const [primary, burden] = effects;
  if (!primary) {
    return '此人命数未明，气机流转尚无定性。';
  }
  void burden;
  return primary.description;
}

export function buildPresetFateDescription(
  definition: FateEffectDefinition,
  quality: Quality,
  primaryEffect: FateEffectEntry,
): string {
  const template = getFateTextPreset(definition, quality).descriptionTemplate;
  if (!template.includes('{effectDescription}')) {
    return template;
  }
  return template.replace(
    '{effectDescription}',
    primaryEffect.description.replace(/。$/, ''),
  );
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
