import { expect, it } from 'vitest';
import { generateForgedEquipment } from '../equipment/forging';
import { DAO_WEAPON_TYPES } from '../equipment/weapons';
import { projectCharacterToCombatV6 } from './project-character';
import type { CharacterCombatInput } from './types';

const input: CharacterCombatInput = {
  cultivator: {
    id: 'weapon-projection',
    name: '器形验收',
    realm: '化神',
    realm_stage: '初期',
    attributes: {
      vitality: 100,
      strength: 100,
      spirit: 100,
      endurance: 100,
      speed: 100,
      willpower: 100,
    },
  },
  side: 0,
  slot: 0,
  resourcePolicy: 'full',
  equipment: {},
  manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
};

it.each(DAO_WEAPON_TYPES)(
  '%s通过完整人物投影只增加保存的器胚数值',
  (weaponType) => {
    const generated = generateForgedEquipment({
      id: 'weapon',
      createdAt: '2026-09-22',
      seed: 17,
      weaponType,
      templateId: 'dao_equipment.standard.weapon.v1',
      equipmentLevel: 90,
      boosts: { ore: 0, essence: 0, attributes: 0 },
    });
    if (!generated.ok) throw new Error('生成失败');
    const equipment = {
      ...generated.instance,
      attributeBonuses: [],
      essenceIds: [],
      artId: undefined,
    };
    const before = projectCharacterToCombatV6(input);
    const after = projectCharacterToCombatV6({
      ...input,
      equipment: { weapon: equipment },
    });
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) throw new Error('投影失败');
    for (const attr of ['physicalAtk', 'magicAtk', 'healPower'] as const) {
      expect(after.unit.attrs[attr] - before.unit.attrs[attr]).toBe(
        equipment.baseStats.find((stat) => stat.attr === attr)!.value,
      );
    }
  },
);
