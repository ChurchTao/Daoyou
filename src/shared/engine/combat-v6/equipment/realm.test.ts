import { getRealmStageLevel } from '@shared/config/realmProgression';
import { forgingBoosts } from '@shared/forging/rules';
import { REALM_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  compileDaoEquipmentLoadoutV1,
  compileDaoEquipmentSpecialLoadoutV1,
} from './compiler';
import { generateDaoEquipmentV1 } from './generator';
import { EQUIPMENT_LEVELS, equipmentRealm, isEquipmentLevel } from './realm';

describe('九境界道装门槛', () => {
  it.each(EQUIPMENT_LEVELS)(
    '%s 档在境界初期可装备，前一境界不可装备',
    (level) => {
      const index = EQUIPMENT_LEVELS.indexOf(level);
      const required = getRealmStageLevel(REALM_VALUES[index], '初期');
      expect(equipmentRealm(level)).toEqual({
        realm: REALM_VALUES[index],
        requiredLevel: required,
      });
      const generated = generateDaoEquipmentV1({
        id: 'realm-equipment',
        createdAt: '2026-09-12',
        seed: 1,
        templateId: 'dao_equipment.standard.weapon.v1',
        equipmentLevel: level,
        generatorVersion: 'dao_equipment_generator_v1',
      });
      expect(generated.ok).toBe(true);
      if (!generated.ok) throw new Error('生成失败');
      expect(generated.instance.requiredLevel).toBe(required);
      for (const compile of [
        compileDaoEquipmentLoadoutV1,
        compileDaoEquipmentSpecialLoadoutV1,
      ]) {
        expect(compile({ weapon: generated.instance }, required).ok).toBe(true);
        expect(compile({ weapon: generated.instance }, required - 1).ok).toBe(
          false,
        );
        expect(
          compile(
            { weapon: { ...generated.instance, requiredLevel: level } },
            180,
          ).ok,
        ).toBe(false);
      }
    },
  );

  it('不再接受已合并的旧器阶', () => {
    for (let level = 20; level <= 180; level += 20)
      expect(isEquipmentLevel(level)).toBe(false);
  });

  it('炼气初期即可铸造炼气图纸', () => {
    expect(
      forgingBoosts(10, 5, [
        { facts: { name: '玄铁', type: 'ore', rank: '凡品' }, quantity: 1 },
      ]),
    ).toEqual({ ore: 1, essence: 0, attributes: 0 });
  });
});
