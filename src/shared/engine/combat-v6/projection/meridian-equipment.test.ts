import { describe, expect, it } from 'vitest';
import { ELEMENT_VALUES } from '../../../types/constants';
import { generateForgedEquipment } from '../equipment/forging';
import { generateDaoEquipmentV2 } from '../equipment/generator';
import { projectCharacterToCombatV6, type CharacterCombatInput } from './index';
import baseline from './fixtures/before-a1.json';

const input = baseline.inputs[0] as unknown as CharacterCombatInput;
const weaponInput = {
  id: 'meridian-weapon', createdAt: '2026-09-22', seed: 17,
  templateId: 'dao_equipment.standard.weapon.v1', equipmentLevel: 10,
  boosts: { ore: 0, essence: 0, attributes: 0 },
};
const weapon = generateForgedEquipment(weaponInput);
const armor = generateForgedEquipment({ ...weaponInput, id: 'meridian-armor', templateId: 'dao_equipment.standard.armor.v1' });
if (!weapon.ok || !armor.ok) throw new Error('锻造失败');

describe('杀意和杀伐的装备条件投影', () => {
  it('金火风逐件计数，任意混搭两件均可触发杀伐，其余五行不计', () => {
    for (const first of ELEMENT_VALUES) for (const second of ELEMENT_VALUES) {
      const result = projectCharacterToCombatV6({ ...input, equipment: {
        weapon: { ...weapon.instance, element: first }, armor: { ...armor.instance, element: second },
      } });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const count = [first, second].filter(element => ['金', '火', '风'].includes(element)).length;
      expect(result.unit.combatFacts?.metalFireWindEquipmentCount).toBe(count);
      expect(result.unit.tags?.includes('equipment.weapon_armor.metal_fire_wind')).toBe(count === 2);
    }
  });
  it('空槽和旧版无五行装备不算符合条件', () => {
    const old = generateDaoEquipmentV2({ ...weaponInput, generatorVersion: 'dao_equipment_generator_v2' });
    if (!old.ok) throw new Error('旧生成器失败');
    for (const equippedWeapon of [undefined, old.instance]) {
      const result = projectCharacterToCombatV6({ ...input, equipment: {
        weapon: equippedWeapon, armor: { ...armor.instance, element: '风' },
      } });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.unit.combatFacts?.metalFireWindEquipmentCount).toBe(1);
      expect(result.unit.tags).not.toContain('equipment.weapon_armor.metal_fire_wind');
    }
  });
});


describe('幽都克敌与阎罗装备投影', () => {
  it('克敌只检查自身武器的水冰土，衣服元素不参与；武器伤害独立于人物总物攻', () => {
    for (const element of ELEMENT_VALUES) {
      const result = projectCharacterToCombatV6({ ...input, equipment: {
        weapon: { ...weapon.instance, element }, armor: { ...armor.instance, element: '水' },
      } });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.unit.tags?.includes('equipment.weapon.water_ice_earth')).toBe(['水', '冰', '土'].includes(element));
      const ownDamage = weapon.instance.baseStats.filter(r => r.attr === 'physicalAtk').reduce((sum, r) => sum + r.value, 0);
      expect(result.unit.combatFacts?.weaponDamage).toBe(ownDamage);
    }
  });
});
