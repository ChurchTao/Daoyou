import { describe, expect, it } from 'vitest';
import { DAO_FORMATION_INSCRIPTIONS_V1 } from '../equipment/content';
import { generateForgedEquipment } from '../equipment/forging';
import type { DaoEquipmentInstanceV1, DaoEquipmentSlot } from '../equipment/types';
import { daoyouFormulas } from '../rules-daoyou/formulas';
import { projectCharacterToCombatV6 } from './project-character';
import type { CharacterCombatInput } from './types';

const input: CharacterCombatInput = {
  cultivator: {
    id: 'inscription-projection', name: '双孔验收', realm: '化神', realm_stage: '初期',
    attributes: { vitality: 100, strength: 100, spirit: 100, endurance: 100, speed: 100, willpower: 100 },
  },
  side: 0, slot: 0, resourcePolicy: 'full', equipment: {},
  manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
};
function equipment(slot: DaoEquipmentSlot, formationInscriptions: DaoEquipmentInstanceV1['formationInscriptions'], weaponType: 'axe' | 'banner' = 'axe'): DaoEquipmentInstanceV1 {
  const result = generateForgedEquipment({
    id: slot, createdAt: '2026-09-23', seed: 17, baseQuality: 1,
    templateId: `dao_equipment.standard.${slot}.v1`, equipmentLevel: 90,
    weaponType: slot === 'weapon' ? weaponType : undefined,
    boosts: { ore: 5, essence: 0, attributes: 0 },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { ...result.instance, attributeBonuses: [], essenceIds: [], artId: undefined, formationInscriptions };
}
function project(loadout: CharacterCombatInput['equipment']) {
  const result = projectCharacterToCombatV6({ ...input, equipment: loadout });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.unit;
}

describe('双孔阵纹完整人物投影', () => {
  it('九种阵纹跨装备叠加，最终面板只增加固定贡献，不受器形或材料倍率影响', () => {
    for (const definition of DAO_FORMATION_INSCRIPTIONS_V1) for (const weaponType of ['axe', 'banner'] as const) {
      const plain: CharacterCombatInput['equipment'] = {};
      const engraved: CharacterCombatInput['equipment'] = {};
      for (const slot of definition.allowedSlots) {
        plain[slot] = equipment(slot, [null, null], weaponType);
        engraved[slot] = equipment(slot, [{ patternId: definition.id, level: 11 }, { patternId: definition.id, level: 11 }], weaponType);
      }
      expect(project(engraved).attrs[definition.attr] - project(plain).attrs[definition.attr]).toBe(definition.allowedSlots.length * 22 * definition.valuePerLevel);
    }
  });

  it('玄锋等级取武器单孔最高，攻击取双孔总和；其他装备和异种不混入', () => {
    const head = equipment('head', [{ patternId: 'dao_inscription.xuanfeng', level: 11 }, { patternId: 'dao_inscription.xuanfeng', level: 11 }]);
    const weapon = equipment('weapon', [{ patternId: 'dao_inscription.xuanfeng', level: 7 }, { patternId: 'dao_inscription.xuanfeng', level: 11 }]);
    const baseAttack = weapon.baseStats.find(r => r.attr === 'physicalAtk')!.value;
    expect(project({ weapon, head }).combatFacts).toMatchObject({ weaponXuanfengLevel: 11, weaponXuanfengAttack: 108, weaponDamage: baseAttack + 108 });
    weapon.formationInscriptions[1] = { patternId: 'dao_inscription.lingyao', level: 11 };
    expect(project({ weapon, head }).combatFacts).toMatchObject({ weaponXuanfengLevel: 7, weaponXuanfengAttack: 42, weaponDamage: baseAttack + 42 });
    weapon.formationInscriptions[0] = null;
    expect(project({ weapon, head }).combatFacts).toMatchObject({ weaponXuanfengLevel: 0, weaponXuanfengAttack: 0, weaponDamage: baseAttack });
    expect(project({ head }).combatFacts).toMatchObject({ weaponXuanfengLevel: 0, weaponXuanfengAttack: 0, weaponDamage: 0 });
  });

  it('双孔封印命中与四孔抵抗使用点数公式，且不改变普通命中和闪避', () => {
    const weapon = equipment('weapon', [null, null]);
    const belt = equipment('belt', [null, null]);
    const footwear = equipment('footwear', [null, null]);
    const source = project({ weapon });
    const target = project({ belt, footwear });
    weapon.formationInscriptions = [{ patternId: 'dao_inscription.dongming', level: 11 }, { patternId: 'dao_inscription.dongming', level: 11 }];
    belt.formationInscriptions = [{ patternId: 'dao_inscription.liuyun', level: 11 }, { patternId: 'dao_inscription.liuyun', level: 11 }];
    footwear.formationInscriptions = [...belt.formationInscriptions];
    const sealed = project({ weapon });
    const resisted = project({ belt, footwear });
    expect(sealed.attrs.hit).toBe(source.attrs.hit);
    expect(resisted.attrs.dodge).toBe(target.attrs.dodge);
    const base = daoyouFormulas.sealHitChance(source, target);
    expect(daoyouFormulas.sealHitChance(sealed, target) - base).toBeCloseTo(0.11);
    expect(daoyouFormulas.sealHitChance(source, resisted) - base).toBeCloseTo(-0.22);
  });
});
