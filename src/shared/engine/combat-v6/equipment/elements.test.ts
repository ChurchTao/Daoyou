import { describe, expect, it } from 'vitest';
import { InventoryEquipmentSchema } from '../../../inventory/equipment';
import { ELEMENT_VALUES } from '../../../types/constants';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV2 } from './generator';

const input = {
  id: 'element-weapon', createdAt: '2026-09-22', seed: 17,
  templateId: 'dao_equipment.standard.weapon.v1', equipmentLevel: 90,
  boosts: { ore: 0, essence: 0, attributes: 0 },
};
function forge(seed = input.seed, boosts = input.boosts) {
  const result = generateForgedEquipment({ ...input, seed, boosts });
  if (!result.ok) throw new Error('锻造失败');
  return result.instance;
}

describe('锻造八行属性', () => {
  it('固定种子可重现，材料择优不改变属性，八种均可产出', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 128; seed++) {
      const first = forge(seed);
      expect(forge(seed)).toEqual(first);
      expect(forge(seed, { ore: 2, essence: 2, attributes: 1 }).element).toBe(first.element);
      expect(ELEMENT_VALUES).toContain(first.element);
      seen.add(first.element!);
      expect(InventoryEquipmentSchema.parse(first).element).toBe(first.element);
      expect(compileDaoEquipmentSpecialLoadoutV1({ weapon: first }, 180).ok).toBe(true);
    }
    expect([...seen].sort()).toEqual([...ELEMENT_VALUES].sort());
  });

  it('拒绝未知五行和缺少五行的新版装备，兼容没有该字段的旧装备', () => {
    const equipment = forge();
    for (const element of ['光', null, undefined]) {
      const invalid = { ...equipment, element };
      expect(InventoryEquipmentSchema.safeParse(invalid).success).toBe(false);
      expect(compileDaoEquipmentSpecialLoadoutV1({ weapon: invalid as typeof equipment }, 180).ok).toBe(false);
    }
    const old = generateDaoEquipmentV2({ ...input, generatorVersion: 'dao_equipment_generator_v2' });
    if (!old.ok) throw new Error('旧生成器失败');
    expect(old.instance.element).toBeUndefined();
    expect(InventoryEquipmentSchema.safeParse(old.instance).success).toBe(true);
    expect(compileDaoEquipmentSpecialLoadoutV1({ weapon: old.instance }, 180).ok).toBe(true);
  });
});
