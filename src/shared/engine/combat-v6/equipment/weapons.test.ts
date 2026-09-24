import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateForgeWeaponType } from '../../../forging/rules';
import { InventoryEquipmentSchema } from '../../../inventory/equipment';
import { SeededRng } from '../core';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler';
import { daoEquipmentBaseRange, daoEquipmentTemplateOf } from './content';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV2 } from './generator';
import { OPEN_EQUIPMENT_LEVELS } from './realm';
import type { DaoEquipmentInstanceV1 } from './types';
import {
  DAO_WEAPONS,
  DAO_WEAPON_TYPES,
  daoWeaponTypeOf,
  type DaoWeaponType,
} from './weapons';

const input = {
  id: 'weapon-type',
  createdAt: '2026-09-22',
  seed: 17,
  templateId: 'dao_equipment.standard.weapon.v1',
  equipmentLevel: 90,
  boosts: { ore: 0, essence: 0, attributes: 0 },
};
function forge(weaponType: DaoWeaponType, overrides = {}) {
  const result = generateForgedEquipment({
    ...input,
    weaponType,
    ...overrides,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.instance;
}
afterEach(() => vi.restoreAllMocks());

describe('法兵器形', () => {
  it('九种器形遵循确认系数，标准剑保持原数值基准', () => {
    expect(
      DAO_WEAPON_TYPES.map((type) => [
        DAO_WEAPONS[type].name,
        DAO_WEAPONS[type].physicalAtk,
        DAO_WEAPONS[type].magicAtk,
      ]),
    ).toEqual([
      ['斧', 1.15, 0.85],
      ['刀', 1.12, 0.88],
      ['枪', 1.09, 0.91],
      ['棍', 1.03, 0.97],
      ['剑', 1, 1],
      ['扇', 0.94, 1.06],
      ['铃', 0.91, 1.09],
      ['笔', 0.88, 1.12],
      ['幡', 0.85, 1.15],
    ]);
  });

  it.each(DAO_WEAPON_TYPES)(
    '%s在全部开放境界与品阶端点生成合法属性，治疗不变',
    (weaponType) => {
      const template = daoEquipmentTemplateOf(input.templateId)!;
      const random = vi.spyOn(SeededRng.prototype, 'next');
      for (const equipmentLevel of OPEN_EQUIPMENT_LEVELS)
        for (const baseQuality of [0, 1 / 3, 0.5, 1])
          for (const upper of [false, true]) {
            random.mockReturnValue(upper ? 0.999999999 : 0);
            const equipment = forge(weaponType, {
              equipmentLevel,
              baseQuality,
              boosts: { ore: 5, essence: 0, attributes: 0 },
            });
            expect(equipment.weaponType).toBe(weaponType);
            expect(equipment.name.endsWith(DAO_WEAPONS[weaponType].name)).toBe(
              true,
            );
            expect(InventoryEquipmentSchema.parse(equipment)).toEqual(
              equipment,
            );
            expect(
              compileDaoEquipmentSpecialLoadoutV1({ weapon: equipment }, 180)
                .ok,
            ).toBe(true);
            for (const rule of template.baseStats) {
              const original = daoEquipmentBaseRange(
                rule,
                equipmentLevel,
                baseQuality,
              );
              const factor =
                rule.attr === 'physicalAtk' || rule.attr === 'magicAtk'
                  ? DAO_WEAPONS[weaponType][rule.attr]
                  : 1;
              expect(
                equipment.baseStats.find((stat) => stat.attr === rule.attr)!
                  .value,
              ).toBe(
                Math.round((upper ? original.max : original.min) * factor),
              );
            }
          }
    },
  );

  it('独立随机事实不随器形变化，择优只提高器胚，保存重载不再次乘系数', () => {
    for (let seed = 0; seed < 32; seed++) {
      const sword = forge('sword', { seed });
      for (const weaponType of DAO_WEAPON_TYPES) {
        const equipment = forge(weaponType, { seed });
        expect(forge(weaponType, { seed })).toEqual(equipment);
        expect(equipment.attributeBonuses).toEqual(sword.attributeBonuses);
        expect(equipment.essenceIds).toEqual(sword.essenceIds);
        expect(equipment.artId).toBe(sword.artId);
        expect(equipment.element).toBe(sword.element);
        expect(equipment.baseStats.find((s) => s.attr === 'healPower')).toEqual(
          sword.baseStats.find((s) => s.attr === 'healPower'),
        );
        const boosted = forge(weaponType, {
          seed,
          boosts: { ore: 5, essence: 0, attributes: 0 },
        });
        boosted.baseStats.forEach((stat, index) =>
          expect(stat.value).toBeGreaterThanOrEqual(
            equipment.baseStats[index].value,
          ),
        );
        expect(
          compileDaoEquipmentSpecialLoadoutV1({ weapon: boosted }, 180).ok,
        ).toBe(true);
        const reloaded = InventoryEquipmentSchema.parse(
          JSON.parse(JSON.stringify(equipment)),
        ) as DaoEquipmentInstanceV1;
        const projection = compileDaoEquipmentSpecialLoadoutV1(
          { weapon: reloaded },
          180,
        );
        expect(projection.ok).toBe(true);
        if (!projection.ok) throw new Error('投影失败');
        // 去除独立器蕴及阵纹后，器胚贡献就是保存的白字，不再应用器形倍率。
        const plain = compileDaoEquipmentSpecialLoadoutV1(
          { weapon: { ...reloaded, essenceIds: [], artId: undefined } },
          180,
        );
        if (!plain.ok) throw new Error('投影失败');
        for (const stat of reloaded.baseStats)
          expect(
            plain.projection.panel.find((s) => s.attr === stat.attr)?.value,
          ).toBe(stat.value);
      }
    }
  });

  it('旧武器统一按剑解析而不改名字或数值；非武器没有器形', () => {
    const generated = generateDaoEquipmentV2({
      ...input,
      generatorVersion: 'dao_equipment_generator_v2',
    });
    if (!generated.ok) throw new Error('生成失败');
    for (const generatorVersion of [
      'dao_equipment_generator_v1',
      'dao_equipment_generator_v2',
      'dao_equipment_generator_v3',
      'dao_equipment_generator_v4',
    ] as const) {
      const old = {
        ...generated.instance,
        essenceIds: [],
        artId: undefined,
        generatorVersion,
        ...(generatorVersion === 'dao_equipment_generator_v3' ||
        generatorVersion === 'dao_equipment_generator_v4'
          ? { name: '旧日长戟', element: '金' as const }
          : {}),
      };
      const before = JSON.stringify(old);
      expect(daoWeaponTypeOf(InventoryEquipmentSchema.parse(old))).toBe(
        'sword',
      );
      expect(compileDaoEquipmentSpecialLoadoutV1({ weapon: old }, 180).ok).toBe(
        true,
      );
      expect(JSON.stringify(old)).toBe(before);
    }
    expect(daoWeaponTypeOf({ slot: 'head' })).toBeUndefined();
  });

  it('拒绝缺失、非法、错部位的器形及伪装成旧版本的偏向武器', () => {
    const equipment = forge('axe');
    for (const invalid of [
      { ...equipment, weaponType: undefined },
      { ...equipment, weaponType: 'unknown' },
      { ...equipment, weaponType: null },
      { ...equipment, weaponType: 'constructor' },
      { ...equipment, slot: 'head' },
      { ...equipment, generatorVersion: 'dao_equipment_generator_v4' },
    ]) {
      expect(InventoryEquipmentSchema.safeParse(invalid).success).toBe(false);
      expect(
        compileDaoEquipmentSpecialLoadoutV1(
          { weapon: invalid as DaoEquipmentInstanceV1 },
          180,
        ).ok,
      ).toBe(false);
    }
    expect(
      generateForgedEquipment({
        ...input,
        weaponType: 'unknown' as DaoWeaponType,
      }).ok,
    ).toBe(false);
    expect(
      generateForgedEquipment({
        ...input,
        weaponType: null as unknown as DaoWeaponType,
      }).ok,
    ).toBe(false);
    expect(
      generateForgedEquipment({
        ...input,
        templateId: 'dao_equipment.standard.head.v1',
        weaponType: 'sword',
      }).ok,
    ).toBe(false);
    const tooHigh = {
      ...equipment,
      baseStats: equipment.baseStats.map((s) => ({
        ...s,
        value: s.value + 10000,
      })),
    };
    expect(
      compileDaoEquipmentSpecialLoadoutV1({ weapon: tooHigh }, 180).ok,
    ).toBe(false);
    expect(() => validateForgeWeaponType('weapon')).toThrow('必须指定');
    expect(() => validateForgeWeaponType('armor', 'sword')).toThrow('只有法兵');
    expect(() => validateForgeWeaponType('weapon', 'fan')).not.toThrow();
    expect(() => validateForgeWeaponType('armor')).not.toThrow();
  });
});
