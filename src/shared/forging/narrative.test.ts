import { describe, expect, it } from 'vitest';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../engine/combat-v6/equipment/compiler';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { ForgeIntentSchema, ForgedEquipmentCopySchema } from './narrative';

describe('forged equipment narrative', () => {
  it('counts intent and description by Unicode code points', () => {
    expect(ForgeIntentSchema.parse('  愿平安归家  ')).toBe('愿平安归家');
    expect(ForgeIntentSchema.parse(' ')).toBe('');
    expect(ForgeIntentSchema.safeParse('𠮷'.repeat(100)).success).toBe(true);
    expect(ForgeIntentSchema.safeParse('念'.repeat(101)).success).toBe(false);
    expect(
      ForgedEquipmentCopySchema.safeParse({
        name: '照归剑',
        desc: '𠮷'.repeat(60),
      }).success,
    ).toBe(true);
    expect(
      ForgedEquipmentCopySchema.safeParse({
        name: '照归剑',
        desc: '归'.repeat(61),
      }).success,
    ).toBe(false);
  });

  it('rejects empty, oversized or unsafe generated copy and extra fields', () => {
    for (const name of [
      '',
      '剑',
      '长'.repeat(9),
      '<剑>',
      '照\n归剑',
      '照归剑\n',
      '照归剑\u202e',
    ]) {
      expect(
        ForgedEquipmentCopySchema.safeParse({
          name,
          desc: '霜纹映月，寄一念归心。',
        }).success,
      ).toBe(false);
    }
    for (const desc of [
      '',
      '<script>',
      '霜纹\n映月',
      '霜纹\u202e映月',
      '霜纹\u2028映月',
      '霜纹\u2029映月',
    ]) {
      expect(
        ForgedEquipmentCopySchema.safeParse({ name: '照归剑', desc }).success,
      ).toBe(false);
    }
    expect(
      ForgedEquipmentCopySchema.safeParse({
        name: '照归剑',
        desc: '霜纹映月。',
        physicalAtk: 999,
      }).success,
    ).toBe(false);
  });

  it('preserves narrative snapshots through inventory parsing and equipment compilation', () => {
    const generated = generateForgedEquipment({
      id: 'forged-narrative',
      createdAt: '2026-09-21T00:00:00Z',
      seed: 42,
      templateId: 'dao_equipment.standard.weapon.v1',
      equipmentLevel: 10,
      boosts: { ore: 1, essence: 0, attributes: 0 },
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const original = generated.instance;
    const equipment = {
      ...original,
      name: '照归剑',
      desc: '霜纹映月，寄一念归心。',
      crafterName: '沈归舟',
    };
    expect(InventoryEquipmentSchema.parse(equipment)).toEqual(equipment);
    expect(InventoryEquipmentSchema.parse(original)).toEqual(original);
    expect(
      compileDaoEquipmentSpecialLoadoutV1({ weapon: equipment }, 10),
    ).toEqual(compileDaoEquipmentSpecialLoadoutV1({ weapon: original }, 10));
    expect(
      compileDaoEquipmentSpecialLoadoutV1({ weapon: equipment }, 10).ok,
    ).toBe(true);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { weapon: { ...equipment, slot: 'head' } },
        10,
      ).ok,
    ).toBe(false);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        {
          weapon: {
            ...equipment,
            baseStats: original.baseStats.map((stat) => ({
              ...stat,
              value: 999999,
            })),
          },
        },
        10,
      ).ok,
    ).toBe(false);
    expect(
      compileDaoEquipmentSpecialLoadoutV1(
        { weapon: { ...equipment, desc: '长'.repeat(61) } },
        10,
      ).ok,
    ).toBe(false);
  });
});
