import { describe, expect, it } from 'vitest';
import { InventoryEquipmentSchema } from '../../../inventory/equipment';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler';
import { DAO_FORMATION_INSCRIPTIONS_V1 } from './content';
import { generateForgedEquipment } from './forging';
import { DAO_EQUIPMENT_SLOTS, type DaoEquipmentInstanceV1, type DaoEquipmentSlot } from './types';

function equipment(slot: DaoEquipmentSlot, equipmentLevel = 90): DaoEquipmentInstanceV1 {
  const result = generateForgedEquipment({
    id: slot, createdAt: '2026-09-23', seed: 17,
    templateId: `dao_equipment.standard.${slot}.v1`, equipmentLevel,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { ...result.instance, essenceIds: [], artId: undefined };
}
function compile(instance: DaoEquipmentInstanceV1) {
  return compileDaoEquipmentSpecialLoadoutV1({ [instance.slot]: instance }, 180);
}

describe('双孔阵纹', () => {
  it('保留已有类型 ID，删除沧海并按确认方案配置九种阵纹', () => {
    expect(DAO_FORMATION_INSCRIPTIONS_V1.map(d => [d.id, d.name, d.attr, d.valuePerLevel, d.allowedSlots])).toEqual([
      ['dao_inscription.xuanfeng', '玄锋阵纹', 'physicalAtk', 6, ['weapon', 'head']],
      ['dao_inscription.lingyao', '灵曜阵纹', 'magicAtk', 4, ['weapon', 'necklace']],
      ['dao_inscription.jingang', '金刚阵纹', 'physicalDef', 8, ['head', 'armor']],
      ['dao_inscription.xuanjia', '玄甲阵纹', 'magicDef', 6, ['armor', 'necklace']],
      ['dao_inscription.changsheng', '长生阵纹', 'maxHp', 40, ['armor', 'belt']],
      ['dao_inscription.jifeng', '疾风阵纹', 'speed', 4, ['belt', 'footwear']],
      ['dao_inscription.dongming', '洞明阵纹', 'sealHit', 1, ['weapon']],
      ['dao_inscription.liuyun', '定神阵纹', 'sealResist', 1, ['belt', 'footwear']],
      ['dao_inscription.huichun', '回春阵纹', 'healPower', 6, ['weapon', 'armor']],
    ]);
  });

  it.each([[10, 3], [30, 5], [50, 7], [70, 9], [90, 11]])(
    '%i档全部部位具有两个孔，单孔上限%i级，升级人物不放宽装备上限',
    (level, cap) => {
      for (const slot of DAO_EQUIPMENT_SLOTS) {
        const base = equipment(slot, level);
        expect(base.formationInscriptions).toEqual([null, null]);
        expect(InventoryEquipmentSchema.parse(base)).toEqual(base);
        const definition = DAO_FORMATION_INSCRIPTIONS_V1.find(d => d.allowedSlots.includes(slot))!;
        const max = { patternId: definition.id, level: cap };
        const valid = { ...base, formationInscriptions: [max, max] } as DaoEquipmentInstanceV1;
        expect(compile(valid).ok).toBe(true);
        expect(InventoryEquipmentSchema.safeParse(valid).success).toBe(true);
        const invalid = { ...base, formationInscriptions: [max, { ...max, level: cap + 1 }] } as DaoEquipmentInstanceV1;
        expect(compile(invalid).ok).toBe(false);
        expect(InventoryEquipmentSchema.safeParse(invalid).success).toBe(false);
      }
    },
  );

  it('九种阵纹逐部位校验，两个同种不同级的贡献相加且保存重载不重算倍率', () => {
    for (const definition of DAO_FORMATION_INSCRIPTIONS_V1) {
      for (const slot of DAO_EQUIPMENT_SLOTS) {
        const base = equipment(slot);
        const engraved = {
          ...base,
          formationInscriptions: [{ patternId: definition.id, level: 11 }, { patternId: definition.id, level: 2 }],
        } as DaoEquipmentInstanceV1;
        const allowed = definition.allowedSlots.includes(slot);
        expect(InventoryEquipmentSchema.safeParse(engraved).success).toBe(allowed);
        const result = compile(engraved);
        expect(result.ok).toBe(allowed);
        if (!allowed || !result.ok) continue;
        const plain = compile(base);
        if (!plain.ok) throw new Error('空孔装备无效');
        const value = (rolls: typeof plain.projection.panel) => rolls.find(r => r.attr === definition.attr)?.value ?? 0;
        expect(value(result.projection.panel) - value(plain.projection.panel)).toBe(definition.valuePerLevel * 13);
        const reloaded = InventoryEquipmentSchema.parse(JSON.parse(JSON.stringify(engraved))) as DaoEquipmentInstanceV1;
        expect(compile(reloaded)).toEqual(result);
      }
    }
  });

  it('允许异种混搭和任意一孔为空，孔位在序列化后保留', () => {
    const base = equipment('weapon', 10);
    for (const slots of [
      [null, null],
      [{ patternId: 'dao_inscription.xuanfeng', level: 3 }, null],
      [null, { patternId: 'dao_inscription.huichun', level: 2 }],
      [{ patternId: 'dao_inscription.xuanfeng', level: 3 }, { patternId: 'dao_inscription.lingyao', level: 1 }],
    ]) {
      const instance = { ...base, formationInscriptions: slots } as DaoEquipmentInstanceV1;
      expect(compile(instance).ok).toBe(true);
      expect(InventoryEquipmentSchema.parse(JSON.parse(JSON.stringify(instance))).formationInscriptions).toEqual(slots);
    }
  });

  it('拒绝旧字段、错误孔数、非整级、越界、未知与已移除类型', () => {
    const base = equipment('weapon', 10);
    for (const slots of [
      undefined, null, [], [null], [null, null, null], [undefined, null],
      [false, null], [{ patternId: 'missing', level: 1 }, null],
      [{ patternId: 'dao_inscription.canghai', level: 1 }, null],
      ...[0, -1, 1.5, 4, NaN, Infinity].map(level => [{ patternId: 'dao_inscription.xuanfeng', level }, null]),
    ]) {
      const instance = { ...base, formationInscriptions: slots } as DaoEquipmentInstanceV1;
      expect(InventoryEquipmentSchema.safeParse(instance).success).toBe(false);
      expect(compile(instance).ok).toBe(false);
    }
    const legacy = { ...base, formationInscription: { patternId: 'dao_inscription.xuanfeng', level: 1 } };
    expect(InventoryEquipmentSchema.safeParse(legacy).success).toBe(false);
    expect(compile(legacy).ok).toBe(false);
  });
});
