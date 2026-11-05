import { REALM_VALUES } from '@daoyou/constants/realms';
import {
  EQUIPMENT_LEVELS,
  OPEN_EQUIPMENT_LEVELS,
  isEquipmentLevel,
  type DaoEquipmentInstanceV1,
} from '@daoyou/game-domain/equipment';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler.js';
import { generateForgedEquipment } from './forging.js';
import { equipmentRealm } from './realm.js';

function forgeWeapon(equipmentLevel: number) {
  const result = generateForgedEquipment({
    id: 'realm-equipment',
    createdAt: '2026-09-12',
    seed: 1,
    templateId: 'dao_equipment.standard.weapon.v1',
    equipmentLevel,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!result.ok) throw new Error('生成失败');
  return { ...result.instance, essenceIds: [] };
}

describe('九境界道装门槛', () => {
  it.each(OPEN_EQUIPMENT_LEVELS)(
    '%s 档在境界初期可装备，前一境界不可装备',
    (level) => {
      const index = EQUIPMENT_LEVELS.indexOf(level);
      const required = getRealmStageLevel(REALM_VALUES[index], '初期');
      expect(equipmentRealm(level)).toEqual({
        realm: REALM_VALUES[index],
        requiredLevel: required,
      });
      const weapon = forgeWeapon(level);
      expect(weapon.requiredLevel).toBe(required);
      expect(compileDaoEquipmentSpecialLoadoutV1({ weapon }, required).ok).toBe(
        true,
      );
      expect(
        compileDaoEquipmentSpecialLoadoutV1({ weapon }, required - 1).ok,
      ).toBe(false);
      expect(
        compileDaoEquipmentSpecialLoadoutV1(
          { weapon: { ...weapon, requiredLevel: level } },
          180,
        ).ok,
      ).toBe(false);
    },
  );

  it('不再接受已合并的旧器阶', () => {
    for (let level = 20; level <= 180; level += 20)
      expect(isEquipmentLevel(level)).toBe(false);
  });

  it('拒绝同一实例占据多个槽位与跨部位装配', () => {
    const weapon = forgeWeapon(10);
    const result = compileDaoEquipmentSpecialLoadoutV1(
      { weapon, armor: weapon },
      180,
    );
    if (result.ok) throw new Error('重复装配应被拒绝');
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_EQUIPMENT_INSTANCE',
        'EQUIPMENT_SLOT_MISMATCH',
      ]),
    );
  });

  it('拒绝畸形白字、绿字及运行时专用字段', () => {
    const weapon = forgeWeapon(90);
    const [first, ...rest] = weapon.baseStats;
    const malformed: [DaoEquipmentInstanceV1, string][] = [
      [{ ...weapon, baseStats: rest }, 'INVALID_EQUIPMENT_BASE_STAT'],
      [
        { ...weapon, baseStats: [{ ...first, value: Infinity }, ...rest] },
        'INVALID_EQUIPMENT_BASE_STAT',
      ],
      [
        {
          ...weapon,
          attributeBonuses: [
            { attr: 'strength', value: 20 },
            { attr: 'strength', value: 20 },
          ],
        },
        'INVALID_EQUIPMENT_ATTRIBUTE_BONUS',
      ],
      [
        { ...weapon, attributeBonuses: [{ attr: 'strength', value: 999 }] },
        'INVALID_EQUIPMENT_ATTRIBUTE_BONUS',
      ],
      [{ ...weapon, templateId: 'missing' }, 'UNKNOWN_EQUIPMENT_TEMPLATE'],
      [
        Object.assign({ ...weapon }, { battleProjection: {} }),
        'FORBIDDEN_EQUIPMENT_FIELD',
      ],
    ];
    for (const [invalid, diagnostic] of malformed) {
      const result = compileDaoEquipmentSpecialLoadoutV1(
        { weapon: invalid },
        180,
      );
      if (result.ok) throw new Error(`应拒绝 ${diagnostic}`);
      expect(result.diagnostics.map(({ code }) => code)).toContain(diagnostic);
    }
  });
});
