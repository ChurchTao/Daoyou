import { describe, expect, it } from 'vitest';
import { EnlightenmentRequestSchema } from '../contracts/enlightenment';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import { type InventoryItem } from '../inventory';
import { inventoryStackIdentity } from '../inventory/stack-key';
import {
  ENLIGHTENMENT_QUALITIES,
  enlightenmentDistribution,
  enlightenmentMaterialProblem,
  prepareEnlightenment,
  previewEnlightenment,
  rollEnlightenment,
} from './enlightenment';

const item = (quantity = 4): InventoryItem => ({
  id: 'book',
  location: 'bag',
  slotIndex: 0,
  definitionId: 'material.v1',
  quantity,
  revision: 0,
  stackKey: 'material',
  instanceData: { name: '旧典籍', type: 'gongfa_manual', rank: '玄品' },
});
const ref = { id: 'book', revision: 0, quantity: 4 };

describe('悟道室', () => {
  it('209种组合概率归一、每格25%，拆合各境界期望一致', () => {
    let count = 0;
    function visit(
      qs: (typeof ENLIGHTENMENT_QUALITIES)[number][],
      start: number,
    ) {
      if (qs.length) {
        count++;
        const p = previewEnlightenment(qs, 1);
        expect(p.successChance).toBe(qs.length / 4);
        expect(p.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(
          p.successChance,
          12,
        );
        for (let r = 0; r < 4; r++)
          expect(p.probabilities[r]).toBeCloseTo(
            qs.reduce(
              (sum, q) => sum + previewEnlightenment([q], 1).probabilities[r],
              0,
            ),
            12,
          );
        const reversed = previewEnlightenment([...qs].reverse(), 1);
        for (let r = 0; r < 4; r++)
          expect(reversed.probabilities[r]).toBeCloseTo(p.probabilities[r], 12);
      }
      if (qs.length < 4)
        for (let i = start; i < 6; i++)
          visit([...qs, ENLIGHTENMENT_QUALITIES[i]], i);
    }
    visit([], 0);
    expect(count).toBe(209);
  });
  it('高品加低品不放大高阶绝对产出率，满格必成', () => {
    const single = previewEnlightenment(['天品'], 1);
    const full = previewEnlightenment(['天品', '凡品', '凡品', '凡品'], 1);
    expect(single.probabilities[3]).toBe(0.25);
    expect(full.probabilities).toEqual([0.75, 0, 0, 0.25]);
    expect(rollEnlightenment(single, () => 0.99)).toBeNull();
    expect(rollEnlightenment(full, () => 0.999999)).toMatch(/^jade\./);
  });
  it('材料上限不裁剪高阶产出', () => {
    expect(enlightenmentMaterialProblem(item(), '炼气')).toBeNull();
    expect(enlightenmentDistribution('玄品')[2]).toBeGreaterThan(0);
    const higher = {
      ...item(),
      instanceData: { name: '高阶典籍', type: 'gongfa_manual', rank: '真品' },
    };
    expect(enlightenmentMaterialProblem(higher, '炼气')).toContain('筑基');
    expect(enlightenmentMaterialProblem(higher, '筑基')).toBeNull();
    expect(() => previewEnlightenment(['仙品'], 1)).toThrow();
    expect(
      enlightenmentMaterialProblem(
        {
          ...item(),
          instanceData: { name: '秘术', type: 'skill_manual', rank: '玄品' },
        },
        '元婴',
      ),
    ).toBeTruthy();
  });
  it('灵气按1至6线性累加，感悟折扣合计向上取整并至少1点', () => {
    expect(
      previewEnlightenment(['凡品', '凡品', '凡品', '凡品'], 1).cost,
    ).toEqual({ qi: 4, baseInsight: 4, insight: 4 });
    expect(
      previewEnlightenment(['天品', '天品', '天品', '天品'], 0.8).cost,
    ).toEqual({ qi: 24, baseInsight: 48, insight: 39 });
    expect(
      previewEnlightenment(['灵品', '灵品', '玄品', '玄品'], 0.8).cost,
    ).toEqual({ qi: 10, baseInsight: 10, insight: 8 });
    expect(previewEnlightenment(['天品'], 0).cost.insight).toBe(1);
    expect(previewEnlightenment(['凡品', '天品'], 1).cost.qi).toBe(7);
  });
  it('命格浮点聚合不多扣一点感悟，拆分不获得取整优惠', () => {
    expect(
      previewEnlightenment(['真品'], 0.6000000000000001).cost.insight,
    ).toBe(3);
    for (const multiplier of [0, 0.6, 0.82, 1, 1.15]) {
      const grouped = previewEnlightenment(['灵品', '玄品', '真品'], multiplier)
        .cost.insight;
      const separate = ['灵品', '玄品', '真品'].reduce(
        (sum, q) =>
          sum +
          previewEnlightenment([q as '灵品' | '玄品' | '真品'], multiplier).cost
            .insight,
        0,
      );
      expect(grouped).toBeLessThanOrEqual(separate);
    }
  });
  it('确定性随机覆盖同境界六本功法以及跨境界抽取', () => {
    const p = previewEnlightenment(['天品', '天品', '天品', '天品'], 1);
    const ids = Array.from({ length: 6 }, (_, i) => {
      const rolls = [0.5, (i + 0.5) / 6];
      return rollEnlightenment(p, () => rolls.shift()!);
    });
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual(
      CHARACTER_MANUALS_V1.filter((m) => m.realm === '元婴').map(
        (m) => `jade.${m.id}`,
      ),
    );
    const crossRealm = prepareEnlightenment([item()], [ref], '炼气', 1).preview;
    const rolls = [0.99999, 0];
    const id = rollEnlightenment(crossRealm, () => rolls.shift()!);
    expect(CHARACTER_MANUALS_V1.find((m) => `jade.${m.id}` === id)?.realm).toBe(
      '金丹',
    );
  });
  it('拒绝空投入、过量、重复引用、过期版本和库存不足', () => {
    expect(() => previewEnlightenment([], 1)).toThrow();
    expect(() => previewEnlightenment(Array(5).fill('凡品'), 1)).toThrow();
    for (const refs of [
      [ref, ref],
      [{ ...ref, revision: 1 }],
      [{ ...ref, quantity: 5 }],
    ])
      expect(() => prepareEnlightenment([item()], refs, '炼气', 1)).toThrow();
    expect(() => prepareEnlightenment([item(3)], [ref], '炼气', 1)).toThrow();
    expect(
      EnlightenmentRequestSchema.safeParse({
        requestId: 'bad',
        materials: [ref],
      }).success,
    ).toBe(false);
  });
  it('消耗后预检所有可能玉简容量，不能因仅有某个同名堆叠而选择性开奖', () => {
    const jade = CHARACTER_MANUALS_V1[0];
    const definitionId = `jade.${jade.id}`;
    const bag = [
      item(5),
      ...Array.from({ length: 39 }, (_, i): InventoryItem => ({
        ...item(),
        id: `jade${i}`,
        slotIndex: i + 1,
        definitionId,
        instanceData: null,
        stackKey: inventoryStackIdentity(definitionId, null),
        quantity: 1,
      })),
    ];
    expect(() => prepareEnlightenment(bag, [ref], '炼气', 1)).toThrow('空位');
    bag[0].quantity = 4;
    expect(
      prepareEnlightenment(bag, [ref], '炼气', 1).afterMaterials,
    ).toHaveLength(39);
  });
});
