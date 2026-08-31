import type { Quality, RealmType } from '@shared/types/constants';
import type { SpiritFieldMethodDefinition, SpiritFieldStage } from './types';

export const SPIRIT_FIELD_METHODS: readonly SpiritFieldMethodDefinition[] = [
  { id: 'seasonal_nurture', stage: 'germination', name: '顺时温养', description: '不强催灵机，依时令静候种体苏醒。', resourceKind: 'none', baseCost: 0 },
  { id: 'qi_sprout', stage: 'germination', name: '天地灵气催芽', description: '引天地灵气叩开种壳。', resourceKind: 'qi', baseCost: 5, durationMultiplier: 0.75 },
  { id: 'stone_soil', stage: 'germination', name: '灵石固壤', description: '以灵石稳住初生根基。', resourceKind: 'spirit_stones', baseCost: 120 },
  { id: 'sun_wake', stage: 'germination', name: '向阳醒种', description: '借晨阳温意唤醒种体。', resourceKind: 'none', baseCost: 0 },
  { id: 'shade_dew', stage: 'germination', name: '荫棚集露', description: '收聚阴棚清露，润开种壳。', resourceKind: 'none', baseCost: 0 },
  { id: 'ore_soil', stage: 'germination', name: '矿砂改土', description: '掺入矿砂改变土性与地脉走向。', resourceKind: 'ore', baseCost: 1 },
  { id: 'aux_formation', stage: 'germination', name: '辅材布阵', description: '以辅材布下小型醒灵阵。', resourceKind: 'aux', baseCost: 1, extraSpiritStoneCost: 80 },
  { id: 'rest_nurture', stage: 'nourishing', name: '静置养性', description: '不施外力，让幼株自行调和。', resourceKind: 'none', baseCost: 0 },
  { id: 'intrinsic_infusion', stage: 'nourishing', name: '本命灌注', description: '以自身法力和灵根气息温养幼株。', resourceKind: 'mp', baseCost: 12 },
  { id: 'qi_growth', stage: 'nourishing', name: '天地灵气催生', description: '引天地灵气加快枝叶舒展。', resourceKind: 'qi', baseCost: 8, durationMultiplier: 0.75 },
  { id: 'herb_companion', stage: 'nourishing', name: '药材伴养', description: '以现有药材作伴生药引。', resourceKind: 'herb', baseCost: 1 },
  { id: 'monster_blood', stage: 'nourishing', name: '妖血沃根', description: '用妖兽材料中的血性精华沃根。', resourceKind: 'monster', baseCost: 1 },
  { id: 'pill_nourish', stage: 'nourishing', name: '化丹培元', description: '化开一枚丹药，将药力归入根脉。', resourceKind: 'pill', baseCost: 1 },
  { id: 'tcdb_return', stage: 'nourishing', name: '天材返哺', description: '以天材地宝反哺幼株本源。', resourceKind: 'tcdb', baseCost: 1 },
  { id: 'aux_gather', stage: 'nourishing', name: '辅阵聚灵', description: '消耗辅材维持聚灵小阵。', resourceKind: 'aux', baseCost: 1, extraSpiritStoneCost: 120 },
  { id: 'leaf_medicine', stage: 'forming', name: '凝叶成药', description: '收束药性于枝叶根茎。', resourceKind: 'none', baseCost: 0 },
  { id: 'flower_fruit', stage: 'forming', name: '开花结果', description: '引导灵机走向花果孕化。', resourceKind: 'none', baseCost: 0 },
  { id: 'return_treasure', stage: 'forming', name: '返源化宝', description: '压缩生机，使其返源凝成天地奇珍。', resourceKind: 'none', baseCost: 0 },
  { id: 'natural_form', stage: 'forming', name: '顺势化形', description: '不预设形态，只顺应此前造化。', resourceKind: 'none', baseCost: 0 },
] as const;

export const SPIRIT_FIELD_METHOD_MAP = Object.fromEntries(SPIRIT_FIELD_METHODS.map((method) => [method.id, method])) as Record<SpiritFieldMethodDefinition['id'], SpiritFieldMethodDefinition>;
export const SPIRIT_SEED_QUALITY_CHANCE_MAP: Record<Quality, number> = { 凡品: 0.3, 灵品: 0.3, 玄品: 0.2, 真品: 0.1, 地品: 0.04, 天品: 0.03, 仙品: 0.02, 神品: 0.01 };
const minutes = (value: number) => value * 60_000;
const hours = (value: number) => value * 60 * 60_000;
export const SPIRIT_FIELD_QUALITY_BALANCE: Record<Quality, { minRealm: RealmType; stageDurationMs: Record<SpiritFieldStage, number>; baseYield: readonly [number, number] }> = {
  凡品: { minRealm: '炼气', stageDurationMs: { germination: minutes(4), nourishing: minutes(4), forming: minutes(4) }, baseYield: [4, 6] },
  灵品: { minRealm: '筑基', stageDurationMs: { germination: minutes(10), nourishing: minutes(10), forming: minutes(10) }, baseYield: [4, 5] },
  玄品: { minRealm: '金丹', stageDurationMs: { germination: minutes(30), nourishing: minutes(30), forming: minutes(30) }, baseYield: [3, 5] },
  真品: { minRealm: '元婴', stageDurationMs: { germination: hours(1), nourishing: hours(1), forming: hours(1) }, baseYield: [3, 4] },
  地品: { minRealm: '化神', stageDurationMs: { germination: hours(2), nourishing: hours(2), forming: hours(2) }, baseYield: [2, 4] },
  天品: { minRealm: '炼虚', stageDurationMs: { germination: hours(4), nourishing: hours(4), forming: hours(4) }, baseYield: [2, 3] },
  仙品: { minRealm: '合体', stageDurationMs: { germination: hours(8), nourishing: hours(8), forming: hours(8) }, baseYield: [2, 3] },
  神品: { minRealm: '大乘', stageDurationMs: { germination: hours(16), nourishing: hours(16), forming: hours(16) }, baseYield: [1, 2] },
};
export const SPIRIT_FIELD_STARTER_BATCHES = [{ rank: '凡品', quantity: 3 }, { rank: '灵品', quantity: 2 }] as const satisfies ReadonlyArray<{ rank: Quality; quantity: number }>;
export function getSpiritFieldQualityBalance(quality: Quality) { return SPIRIT_FIELD_QUALITY_BALANCE[quality]; }
export function getSpiritFieldMethod(id: SpiritFieldMethodDefinition['id']) { return SPIRIT_FIELD_METHOD_MAP[id]; }
export function getSpiritFieldMethodsForStage(stage: SpiritFieldStage) { return SPIRIT_FIELD_METHODS.filter((method) => method.stage === stage); }
