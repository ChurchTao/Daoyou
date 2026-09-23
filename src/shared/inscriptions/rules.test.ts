import { describe, expect, it } from 'vitest';
import { InscriptionRequestSchema } from '../contracts/inscriptions';
import { DAO_FORMATION_INSCRIPTIONS_V1 } from '../engine/combat-v6/equipment/content';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import {
  addItems,
  InventoryItemSchema,
  type InventoryItem,
} from '../inventory';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { inventoryStackIdentity } from '../inventory/stack-key';
import {
  INSCRIPTION_ITEMS,
  inscriptionItemId,
} from '../items/definitions/inscriptions';
import type { MaterialFacts } from '../items/definitions/materials';
import {
  inscriptionMaterialTenths,
  inscriptionStrengthenCost,
  prepareInscriptionDraw,
  prepareInscriptionEquipment,
  prepareInscriptionStrengthen,
  previewInscriptionDraw,
  requiredDrawSlots,
  rollInscriptionDraw,
} from './rules';

const xuanfeng = 'dao_inscription.xuanfeng';
function glyph(
  level = 1,
  quantity = 1,
  pattern = xuanfeng,
  slot = 0,
): InventoryItem {
  const definitionId = inscriptionItemId(pattern, level);
  return {
    id: `glyph-${slot}`,
    definitionId,
    quantity,
    revision: 0,
    instanceData: null,
    location: 'bag',
    slotIndex: slot,
    stackKey: inventoryStackIdentity(definitionId, null),
  };
}
function material(
  type: MaterialFacts['type'] = 'ore',
  quantity = 4,
  rank: MaterialFacts['rank'] = '凡品',
  slot = 0,
): InventoryItem {
  return {
    id: `material-${slot}`,
    definitionId: 'material.v1',
    quantity,
    revision: 0,
    location: 'bag',
    slotIndex: slot,
    stackKey: 'material-test',
    instanceData: {
      name: '绘阵材料',
      type,
      rank,
      element: null,
      description: '',
    },
  };
}
const ref = (item: InventoryItem, quantity = 1) => ({
  id: item.id,
  revision: item.revision,
  quantity,
});
function equipment(
  level = 30,
  slot: 'weapon' | 'belt' = 'weapon',
): InventoryItem {
  const generated = generateForgedEquipment({
    id: 'equipment',
    createdAt: '2026-09-23',
    seed: 21,
    templateId: `dao_equipment.standard.${slot}.v1`,
    equipmentLevel: level,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!generated.ok) throw new Error('生成失败');
  return {
    id: 'equipment',
    definitionId: 'equipment.v6',
    quantity: 1,
    location: 'equipped',
    slotIndex: null,
    instanceData: generated.instance,
    revision: 0,
    stackKey: null,
  };
}

describe('阵纹物品与绘制', () => {
  it('九种类型各有11级固定物品，同种同级堆叠，拒绝实例伪造', () => {
    expect(INSCRIPTION_ITEMS).toHaveLength(99);
    expect(new Set(INSCRIPTION_ITEMS.map((d) => d.id)).size).toBe(99);
    for (const def of INSCRIPTION_ITEMS) {
      expect(
        InventoryItemSchema.safeParse({ ...glyph(), definitionId: def.id })
          .success,
      ).toBe(true);
      expect(
        DAO_FORMATION_INSCRIPTIONS_V1.some((p) => p.id === def.patternId),
      ).toBe(true);
    }
    expect(
      InventoryItemSchema.safeParse({ ...glyph(), instanceData: { level: 11 } })
        .success,
    ).toBe(false);
    expect(InventoryItemSchema.safeParse(glyph(12)).success).toBe(false);
  });
  it('四类材料保留十分位，拒绝灵草与典籍，不因分堆变化', () => {
    expect(
      ['ore', 'monster', 'aux', 'tcdb'].map((type) =>
        inscriptionMaterialTenths(
          material(type as MaterialFacts['type']).instanceData as MaterialFacts,
        ),
      ),
    ).toEqual([10, 12, 15, 25]);
    for (const type of ['herb', 'gongfa_manual', 'skill_manual'] as const)
      expect(() =>
        prepareInscriptionDraw([material(type)], [ref(material(type), 4)]),
      ).toThrow('仅可投入');
    const a = material('monster', 10);
    const b = material('monster', 5, '凡品', 1);
    expect(prepareInscriptionDraw([a], [ref(a, 10)]).preview.totalTenths).toBe(
      120,
    );
    expect(
      prepareInscriptionDraw([a, b], [ref(a, 5), ref(b, 5)]).preview
        .totalTenths,
    ).toBe(120);
  });
  it('按材料总份数贪心分配，保留尾数并按总投入收取灵气', () => {
    expect(previewInscriptionDraw(1120)).toEqual({
      totalTenths: 1120,
      remainderTenths: 0,
      outputs: [
        { level: 5, quantity: 1 },
        { level: 4, quantity: 1 },
        { level: 3, quantity: 1 },
      ],
      cost: { qi: 1, spiritStones: 112 },
    });
    expect(previewInscriptionDraw(180).outputs).toEqual([
      { level: 3, quantity: 1 },
    ]);
    expect(previewInscriptionDraw(180).remainderTenths).toBe(20);
    expect(previewInscriptionDraw(40).cost.qi).toBe(1);
    expect(previewInscriptionDraw(500000).cost.qi).toBe(98);
    expect(previewInscriptionDraw(5120).cost.qi).toBe(1);
    expect(previewInscriptionDraw(5121).cost.qi).toBe(2);
    expect(previewInscriptionDraw(40960 * 3 + 40).outputs).toEqual([
      { level: 11, quantity: 3 },
      { level: 1, quantity: 1 },
    ]);
    for (const value of [0, 39, 39.9, NaN, Infinity])
      expect(() => previewInscriptionDraw(value)).toThrow();
  });
  it('绘制每512份收一点灵气、每份收一灵石，均向上取整且包含余料', () => {
    expect(previewInscriptionDraw(40).cost).toEqual({ qi: 1, spiritStones: 4 });
    expect(previewInscriptionDraw(100).cost).toEqual({
      qi: 1,
      spiritStones: 10,
    });
    expect(previewInscriptionDraw(101).cost).toEqual({
      qi: 1,
      spiritStones: 11,
    });
    expect(previewInscriptionDraw(5120).cost).toEqual({
      qi: 1,
      spiritStones: 512,
    });
    expect(previewInscriptionDraw(5121).cost).toEqual({
      qi: 2,
      spiritStones: 513,
    });
    const divine = material('tcdb', 1, '神品');
    expect(
      prepareInscriptionDraw([divine], [ref(divine)]).preview.cost,
    ).toEqual({ qi: 98, spiritStones: 50000 });
  });
  it('灵气在100点封顶，灵石继续按全部投入计费', () => {
    expect(previewInscriptionDraw(506880).cost.qi).toBe(99);
    expect(previewInscriptionDraw(506881).cost.qi).toBe(100);
    expect(previewInscriptionDraw(512000).cost.qi).toBe(100);
    expect(previewInscriptionDraw(512001).cost).toEqual({
      qi: 100,
      spiritStones: 51201,
    });
    const divine = material('tcdb', 4, '神品');
    expect(
      prepareInscriptionDraw([divine], [ref(divine, 4)]).preview.cost,
    ).toEqual({ qi: 100, spiritStones: 200000 });
  });
  it('最多保留最高三个等级组，余料消散但仍计入灵气消耗', () => {
    const preview = previewInscriptionDraw(9490);
    expect(preview.outputs).toEqual([
      { level: 8, quantity: 1 },
      { level: 7, quantity: 1 },
      { level: 6, quantity: 1 },
    ]);
    expect(preview.remainderTenths).toBe(530);
    expect(preview.cost).toEqual({ qi: 2, spiritStones: 949 });
    expect(
      rollInscriptionDraw(preview, () => 0).map((grant) => grant.quantity),
    ).toEqual([1, 1, 1]);
    expect(previewInscriptionDraw(1200).remainderTenths).toBe(80);
  });
  it('三个等级组不限制同级数量，材料价值由产物和消散余料共同守恒', () => {
    const total = 40960 * 100 + 20480 + 10240 + 5120;
    const preview = previewInscriptionDraw(total);
    expect(preview.outputs).toEqual([
      { level: 11, quantity: 100 },
      { level: 10, quantity: 1 },
      { level: 9, quantity: 1 },
    ]);
    expect(preview.remainderTenths).toBe(5120);
    expect(
      preview.outputs.reduce(
        (sum, output) => sum + output.quantity * 40 * 2 ** (output.level - 1),
        preview.remainderTenths,
      ),
    ).toBe(total);
  });
  it('校验材料数量、位置、版本和四格限制，不修改输入', () => {
    const item = material();
    const frozen = JSON.stringify(item);
    expect(
      prepareInscriptionDraw([item], [ref(item, 4)]).afterMaterials,
    ).toEqual([]);
    expect(JSON.stringify(item)).toBe(frozen);
    for (const quantity of [0, -1, 1.5, 5])
      expect(() =>
        prepareInscriptionDraw([item], [ref(item, quantity)]),
      ).toThrow();
    expect(() =>
      prepareInscriptionDraw([item], [{ ...ref(item, 4), revision: 1 }]),
    ).toThrow('已变化');
    expect(() =>
      prepareInscriptionDraw(
        [{ ...item, location: 'storage', slotIndex: null }],
        [ref(item, 4)],
      ),
    ).toThrow();
    expect(() =>
      prepareInscriptionDraw([item], [ref(item, 2), ref(item, 2)]),
    ).toThrow('重复');
    expect(() =>
      prepareInscriptionDraw([item], Array(5).fill(ref(item))),
    ).toThrow('四种');
  });
  it('随机只分配类型，等级与数量恒定，独立抽取可重复', () => {
    let n = 0;
    const preview = previewInscriptionDraw(40960 * 9);
    const grants = rollInscriptionDraw(preview, () => (n++ + 0.5) / 9);
    expect(grants.map((g) => g.definitionId)).toEqual(
      DAO_FORMATION_INSCRIPTIONS_V1.map((p) => inscriptionItemId(p.id, 11)),
    );
    expect(rollInscriptionDraw(preview, () => 0)).toEqual([
      { definitionId: inscriptionItemId(xuanfeng, 11), quantity: 9 },
    ]);
  });
  it('抽取前校验最坏容量，不允许仅一种同名堆叠时选择性开奖', () => {
    const mat = material('ore', 99, '玄品');
    const full = [
      mat,
      ...Array.from({ length: 39 }, (_, i) => glyph(1, 99, xuanfeng, i + 1)),
    ];
    expect(() => prepareInscriptionDraw(full, [ref(mat, 1)])).toThrow('空格');
    // 消耗完整材料堆叠释放一格，四份只产出一枚时足够。
    const small = material();
    expect(
      prepareInscriptionDraw([small, ...full.slice(1)], [ref(small, 4)]).preview
        .outputs,
    ).toEqual([{ level: 1, quantity: 1 }]);
  });
  it('最坏占格包含九种类型与99枚边界，已有部分堆叠可减少预留', () => {
    expect(requiredDrawSlots([], [{ level: 1, quantity: 9 }])).toBe(9);
    expect(requiredDrawSlots([], [{ level: 1, quantity: 107 }])).toBe(9);
    expect(requiredDrawSlots([], [{ level: 1, quantity: 108 }])).toBe(10);
    const stacks = DAO_FORMATION_INSCRIPTIONS_V1.map((p, i) =>
      glyph(1, 98, p.id, i),
    );
    expect(requiredDrawSlots(stacks, [{ level: 1, quantity: 3 }])).toBe(1);
    expect(requiredDrawSlots(stacks, [{ level: 1, quantity: 18 }])).toBe(9);
  });
  it('随机产出可按固定定义正常入袋和堆叠', () => {
    const preview = previewInscriptionDraw(40960 * 100);
    const grants = rollInscriptionDraw(preview, () => 0);
    let next: InventoryItem[] = [];
    let n = 0;
    for (const grant of grants)
      next = addItems(
        next,
        grant,
        'bag',
        false,
        () => `new-${n++}`,
        inventoryStackIdentity(grant.definitionId, null),
      );
    expect(next.map((i) => i.quantity)).toEqual([99, 1]);
    next.forEach((i) =>
      expect(InventoryItemSchema.safeParse(i).success).toBe(true),
    );
  });
});

describe('合成与烙印', () => {
  it('同堆叠或跨堆叠两两合成，只收灵石，不改变类型', () => {
    const a = glyph(3, 2);
    const plan = prepareInscriptionStrengthen([a], [ref(a, 2)]);
    expect(plan.afterMaterials).toEqual([]);
    expect(plan.grant).toEqual({
      definitionId: inscriptionItemId(xuanfeng, 4),
      quantity: 1,
    });
    expect(plan.cost).toEqual({ spiritStones: 40, qi: 0 });
    const b = glyph(3, 1, xuanfeng, 1);
    expect(
      prepareInscriptionStrengthen([a, b], [ref(a), ref(b)]).afterMaterials[0]
        .quantity,
    ).toBe(1);
    const wrong = glyph(2, 1, xuanfeng, 2);
    expect(() =>
      prepareInscriptionStrengthen([a, wrong], [ref(a), ref(wrong)]),
    ).toThrow('同种同级');
    const other = glyph(3, 1, 'dao_inscription.lingyao', 3);
    expect(() =>
      prepareInscriptionStrengthen([a, other], [ref(a), ref(other)]),
    ).toThrow('同种同级');
    expect(() =>
      prepareInscriptionStrengthen([glyph(11, 2)], [ref(glyph(11, 2), 2)]),
    ).toThrow();
    expect(inscriptionStrengthenCost(11).spiritStones).toBe(5120);
  });
  it('合成产物容量先校验，不能借合成溢出仓库', () => {
    const full = Array.from({ length: 40 }, (_, i) =>
      glyph(1, 99, xuanfeng, i),
    );
    expect(() => prepareInscriptionStrengthen(full, [ref(full[0], 2)])).toThrow(
      '空位',
    );
  });
  it('双孔可同种；覆盖须确认且旧阵纹不返还，输入保持不变', () => {
    const eq = equipment();
    const g = glyph(2, 2);
    const frozen = JSON.stringify(eq);
    const first = prepareInscriptionEquipment(
      [eq, g],
      ref(eq),
      0,
      ref(g),
      'engrave',
      false,
    );
    expect(JSON.stringify(eq)).toBe(frozen);
    const changed = first.after.find((i) => i.id === eq.id)!;
    const remaining = first.after.find((i) => i.id === g.id)!;
    expect(changed.revision).toBe(1);
    expect(() =>
      prepareInscriptionEquipment(
        first.after,
        ref(changed),
        0,
        ref(remaining),
        'engrave',
        false,
      ),
    ).toThrow('确认覆盖');
    const second = prepareInscriptionEquipment(
      first.after,
      ref(changed),
      1,
      ref(remaining),
      'engrave',
      false,
    );
    expect(second.after).toHaveLength(1);
    expect(
      InventoryEquipmentSchema.parse(second.after[0].instanceData)
        .formationInscriptions,
    ).toEqual([
      { patternId: xuanfeng, level: 2 },
      { patternId: xuanfeng, level: 2 },
    ]);
    const replaced = prepareInscriptionEquipment(
      first.after,
      ref(changed),
      0,
      ref(remaining),
      'engrave',
      true,
    );
    expect(replaced.after).toHaveLength(1);
  });
  it('孔内合成消耗一枚，保留另一孔，检查部位与装备上限', () => {
    const eq = equipment(10);
    const g = glyph(2, 2);
    const first = prepareInscriptionEquipment(
      [eq, g],
      ref(eq),
      1,
      ref(g),
      'engrave',
      false,
    );
    const changed = first.after.find((i) => i.id === eq.id)!;
    const remaining = first.after.find((i) => i.id === g.id)!;
    const upgraded = prepareInscriptionEquipment(
      first.after,
      ref(changed),
      1,
      ref(remaining),
      'strengthen_socket',
      false,
    );
    expect(upgraded.cost).toEqual({ qi: 0, spiritStones: 20 });
    expect(
      InventoryEquipmentSchema.parse(upgraded.after[0].instanceData)
        .formationInscriptions,
    ).toEqual([null, { patternId: xuanfeng, level: 3 }]);
    const cap = upgraded.after[0];
    const more = glyph(3);
    expect(() =>
      prepareInscriptionEquipment(
        [cap, more],
        ref(cap),
        1,
        ref(more),
        'strengthen_socket',
        false,
      ),
    ).toThrow('上限');
    expect(() =>
      prepareInscriptionEquipment(
        [equipment(30, 'belt'), g],
        ref(eq),
        0,
        ref(g),
        'engrave',
        false,
      ),
    ).toThrow('部位');
    expect(() =>
      prepareInscriptionEquipment(
        [eq, g],
        ref(eq),
        2,
        ref(g),
        'engrave',
        false,
      ),
    ).toThrow('孔位');
    expect(() =>
      prepareInscriptionEquipment(
        [eq, g],
        { ...ref(eq), revision: 1 },
        0,
        ref(g),
        'engrave',
        false,
      ),
    ).toThrow('已变化');
  });
  it('契约拒绝超四格、非法数量、任意孔位和拆卸操作', () => {
    const base = {
      requestId: '9f6c6548-0561-488e-b659-d8a8e63bec62',
      expectedCost: { qi: 1, spiritStones: 4 },
      action: 'draw',
      materials: [ref(material(), 4)],
      expectedTenths: 40,
    };
    expect(InscriptionRequestSchema.safeParse(base).success).toBe(true);
    expect(
      InscriptionRequestSchema.safeParse({
        ...base,
        materials: Array(5).fill(ref(material())),
      }).success,
    ).toBe(false);
    expect(
      InscriptionRequestSchema.safeParse({
        ...base,
        materials: [ref(material(), 100)],
      }).success,
    ).toBe(false);
    expect(
      InscriptionRequestSchema.safeParse({ ...base, action: 'remove' }).success,
    ).toBe(false);
  });
});
