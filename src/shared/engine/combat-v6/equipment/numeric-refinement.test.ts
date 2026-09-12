import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgingInputs } from '../../../forging/rules';
import { InventoryEquipmentSchema } from '../../../inventory/equipment';
import type { MaterialFacts } from '../../../items/definitions/materials';
import { SeededRng } from '../core';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler';
import { daoEquipmentAttributeRange, daoEquipmentBaseRange, daoEquipmentTemplateOf } from './content';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV2 } from './generator';
import { equipmentReferenceLevel, OPEN_EQUIPMENT_LEVELS } from './realm';
import { DAO_EQUIPMENT_SLOTS, type DaoEquipmentSlot } from './types';

const input = (slot: DaoEquipmentSlot = 'weapon', equipmentLevel = 90) => ({
  id: slot, createdAt: '2026-09-12', seed: 123,
  templateId: `dao_equipment.standard.${slot}.v1`, equipmentLevel,
  generatorVersion: 'dao_equipment_generator_v2' as const,
});
const material = (rank: MaterialFacts['rank'], quantity = 1, type: MaterialFacts['type'] = 'ore') => ({
  facts: { name: '验收灵材', rank, type }, quantity,
});
afterEach(() => vi.restoreAllMocks());

describe('材料品阶决定白字区间，材料种类保留择优', () => {
  it('数量加权、两阶封顶，拆合堆叠不改变结果', () => {
    expect(forgingInputs(90, 85, [material('玄品', 3)]))
      .toEqual({ baseQuality: 0, boosts: { ore: 3, essence: 0, attributes: 0 } });
    const mixed = forgingInputs(90, 85, [material('玄品', 2), material('地品')]);
    expect(mixed.baseQuality).toBe(1 / 3);
    expect(forgingInputs(90, 85, [material('玄品'), material('玄品'), material('地品')])).toEqual(mixed);
    expect(forgingInputs(90, 85, [material('真品', 3)]).baseQuality).toBe(0.5);
    expect(forgingInputs(90, 85, [material('地品', 3)]).baseQuality).toBe(1);
    expect(forgingInputs(90, 85, [material('神品', 3)]).baseQuality).toBe(1);
    expect(forgingInputs(90, 85, [material('地品', 1, 'aux'), material('地品', 2, 'monster')]))
      .toEqual({ baseQuality: 1, boosts: { ore: 0, essence: 0, attributes: 3 } });
  });
  it('高阶材料不能抵消低于门槛的材料，也不能绕过数量、人物境界和开放限制', () => {
    expect(() => forgingInputs(90, 85, [material('凡品'), material('神品', 2)])).toThrow('品质');
    expect(() => forgingInputs(90, 85, [material('地品', 2)])).toThrow('恰好');
    expect(() => forgingInputs(90, 80, [material('地品', 3)])).toThrow('人物境界');
    expect(() => forgingInputs(110, 180, [material('神品', 3)])).toThrow('化神');
  });
  it('100级武器的中间范围按端点插值取整，不是对成品乘倍率', () => {
    const stat = daoEquipmentTemplateOf(input().templateId)!.baseStats[0];
    expect(daoEquipmentBaseRange(stat, 90, 0)).toEqual({ min: 583, max: 749 });
    expect(daoEquipmentBaseRange(stat, 90, 0.5)).toEqual({ min: 612, max: 786 });
    expect(daoEquipmentBaseRange(stat, 90, 1)).toEqual({ min: 641, max: 823 });
  });
  it.each([NaN, Infinity, -0.1, 1.1])('拒绝非法品阶进度 %s', (baseQuality) => {
    expect(generateDaoEquipmentV2({ ...input(), baseQuality }).ok).toBe(false);
  });
});

// 文档100级经典表，顺序对应每个部位的实际白字字段。
const endpoints = {
  weapon: [[583, 130, 150], [749, 168, 270], [641, 143, 165], [823, 184, 297]],
  head: [[583, 87], [749, 112], [641, 95], [823, 123]],
  armor: [[466, 145], [599, 187], [512, 159], [658, 205]],
  necklace: [[160, 87], [206, 112], [176, 95], [226, 123]],
  belt: [[700, 58], [900, 74], [770, 63], [990, 81]],
  footwear: [[87, 66], [112, 119], [95, 72], [123, 130]],
};
it.each(DAO_EQUIPMENT_SLOTS)('%s按文档端点生成，普通和最高品阶均包含上下界', (slot) => {
  const random = vi.spyOn(SeededRng.prototype, 'next');
  for (const baseQuality of [0, 1]) for (const upper of [0, 1]) {
    random.mockReturnValue(upper ? 0.999999999 : 0);
    const result = generateForgedEquipment({ ...input(slot), baseQuality, boosts: { ore: 3, essence: 0, attributes: 0 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('generation failed');
    expect(result.instance.baseStats.map((s) => s.value)).toEqual(endpoints[slot][baseQuality * 2 + upper]);
    expect(InventoryEquipmentSchema.safeParse(result.instance).success).toBe(true);
    expect(compileDaoEquipmentSpecialLoadoutV1({ [slot]: result.instance }, 85).ok).toBe(true);
  }
});
it('五个境界的参考档和双加预算固定，六维不重复且仅法兵法衣有绿字', () => {
  expect(OPEN_EQUIPMENT_LEVELS.map(equipmentReferenceLevel)).toEqual([20, 40, 60, 80, 100]);
  expect(OPEN_EQUIPMENT_LEVELS.map(daoEquipmentAttributeRange)).toEqual([
    { min: 4, max: 7 }, { min: 7, max: 14 }, { min: 11, max: 22 }, { min: 15, max: 29 }, { min: 18, max: 36 },
  ]);
  const seen = new Set<string>();
  for (const slot of DAO_EQUIPMENT_SLOTS) for (let seed = 0; seed < 128; seed++) {
    const result = generateDaoEquipmentV2({ ...input(slot), seed });
    if (!result.ok) throw new Error('generation failed');
    const rolls = result.instance.attributeBonuses;
    expect(new Set(rolls.map((r) => r.attr)).size).toBe(rolls.length);
    if (slot !== 'weapon' && slot !== 'armor') expect(rolls).toEqual([]);
    for (const roll of rolls) {
      seen.add(roll.attr);
      expect(roll.value).toBeGreaterThanOrEqual(18);
      expect(roll.value).toBeLessThanOrEqual(36);
    }
  }
  expect([...seen].sort()).toEqual(['endurance', 'speed', 'spirit', 'strength', 'vitality', 'willpower']);
});
it('拒绝旧数值装备、非武器衣服的绿字及超出材料区间的白字', () => {
  const result = generateDaoEquipmentV2(input('head'));
  if (!result.ok) throw new Error('generation failed');
  const { numericVersion: _version, ...old } = result.instance;
  expect(InventoryEquipmentSchema.safeParse(old).success).toBe(false);
  expect(compileDaoEquipmentSpecialLoadoutV1({ head: { ...result.instance, attributeBonuses: [{ attr: 'willpower', value: 20 }] } }, 85).ok).toBe(false);
  const baseStats = result.instance.baseStats.map((s, i) => i === 0 ? { ...s, value: 823 } : s);
  expect(compileDaoEquipmentSpecialLoadoutV1({ head: { ...result.instance, baseStats } }, 85).ok).toBe(false);
});
