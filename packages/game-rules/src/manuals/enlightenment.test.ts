import {
  CHARACTER_MANUALS_V1,
  ENLIGHTENMENT_QUALITIES,
  ENLIGHTENMENT_REALMS,
} from '@daoyou/game-content/manuals';
import { BASE_PRICES, TYPE_MULTIPLIERS } from '@daoyou/game-content/materials';
import { type InventoryItem } from '@daoyou/game-domain/inventory';
import { describe, expect, it } from 'vitest';
import { inventoryStackIdentity } from '../inventory/stack-key.js';
import {
  enlightenmentDistribution,
  enlightenmentMaterialProblem,
  enlightenmentQualityCap,
  prepareEnlightenment,
  previewEnlightenment,
  rollEnlightenment,
} from './enlightenment.js';

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
  it('八品494种组合概率归一、每格25%，拆合各境界期望一致', () => {
    let count = 0;
    function visit(
      qs: (typeof ENLIGHTENMENT_QUALITIES)[number][],
      start: number,
    ) {
      if (qs.length) {
        count++;
        const p = previewEnlightenment(qs, 1);
        expect(p.probabilities).toHaveLength(8);
        expect(p.successChance).toBe(qs.length / 4);
        expect(p.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(
          p.successChance,
          12,
        );
        for (let r = 0; r < ENLIGHTENMENT_REALMS.length; r++)
          expect(p.probabilities[r]).toBeCloseTo(
            qs.reduce(
              (sum, q) => sum + previewEnlightenment([q], 1).probabilities[r],
              0,
            ),
            12,
          );
        const reversed = previewEnlightenment([...qs].reverse(), 1);
        for (let r = 0; r < ENLIGHTENMENT_REALMS.length; r++)
          expect(reversed.probabilities[r]).toBeCloseTo(p.probabilities[r], 12);
      }
      if (qs.length < 4)
        for (let i = start; i < ENLIGHTENMENT_QUALITIES.length; i++)
          visit([...qs, ENLIGHTENMENT_QUALITIES[i]], i);
    }
    visit([], 0);
    expect(count).toBe(494);
  });
  it('八品按参考价平方根的倒数分配，费用阶梯不变', () => {
    const supports = [
      [0],
      [0, 1],
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [4, 5, 6],
      [5, 6, 7],
    ];
    const references = [
      BASE_PRICES.玄品,
      BASE_PRICES.真品,
      BASE_PRICES.地品,
      BASE_PRICES.天品,
      200_000,
      1_000_000,
      5_000_000,
      25_000_000,
    ];
    const insightCosts = [1, 2, 3, 5, 8, 12, 20, 32];
    const published = [
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0.634, 0.366, 0, 0, 0, 0, 0, 0],
      [0.5281, 0.3049, 0.167, 0, 0, 0, 0, 0],
      [0, 0.5578, 0.3055, 0.1366, 0, 0, 0, 0],
      [0, 0, 0.5985, 0.2677, 0.1338, 0, 0, 0],
      [0, 0, 0, 0.5802, 0.2901, 0.1297, 0, 0],
      [0, 0, 0, 0, 0.6071, 0.2715, 0.1214, 0],
      [0, 0, 0, 0, 0, 0.6071, 0.2715, 0.1214],
    ];
    for (const [rank, quality] of ENLIGHTENMENT_QUALITIES.entries()) {
      const weights = references.map((reference, realm) =>
        supports[rank].includes(realm)
          ? 1 / Math.sqrt(reference * TYPE_MULTIPLIERS.gongfa_manual)
          : 0,
      );
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const distribution = enlightenmentDistribution(quality);
      expect(distribution).toEqual(weights.map((weight) => weight / total));
      distribution.forEach((probability, realm) => {
        expect(probability).toBeCloseTo(published[rank][realm], 4);
      });
      expect(previewEnlightenment([quality], 1).cost).toEqual({
        qi: rank + 1,
        baseInsight: insightCosts[rank],
        insight: insightCosts[rank],
      });
    }
  });
  it('高品加低品不放大高阶绝对产出率，满格必成', () => {
    const single = previewEnlightenment(['天品'], 1);
    const full = previewEnlightenment(['天品', '凡品', '凡品', '凡品'], 1);
    expect(full.successChance).toBe(1);
    expect(full.probabilities[0]).toBeCloseTo(0.75, 12);
    for (let realm = 1; realm < ENLIGHTENMENT_REALMS.length; realm++)
      expect(full.probabilities[realm]).toBeCloseTo(
        single.probabilities[realm],
        12,
      );
    expect(single.probabilities[3]).toBeGreaterThan(single.probabilities[4]);
    expect(single.probabilities[4]).toBeGreaterThan(single.probabilities[5]);
    expect(single.probabilities[5]).toBeGreaterThan(0);
    expect(rollEnlightenment(single, () => 0.99)).toBeNull();
    expect(rollEnlightenment(full, () => 0.999999)).toMatch(/^jade\./);
  });
  it('材料上限不裁剪高阶产出', () => {
    expect(enlightenmentMaterialProblem(item(), '炼气')).toBeNull();
    expect(
      enlightenmentMaterialProblem(
        { ...item(), location: 'storage', slotIndex: null },
        '炼气',
      ),
    ).toBeNull();
    expect(enlightenmentDistribution('玄品')[2]).toBeGreaterThan(0);
    const higher = {
      ...item(),
      instanceData: { name: '高阶典籍', type: 'gongfa_manual', rank: '真品' },
    };
    expect(enlightenmentMaterialProblem(higher, '炼气')).toContain('筑基');
    expect(enlightenmentMaterialProblem(higher, '筑基')).toBeNull();
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
  it.each([
    ['炼气', '玄品'],
    ['筑基', '真品'],
    ['金丹', '地品'],
    ['元婴', '天品'],
    ['化神', '仙品'],
    ['炼虚', '神品'],
    ['合体', '神品'],
    ['大乘', '神品'],
    ['渡劫', '神品'],
  ] as const)('%s境界最高可用%s典籍', (realm, quality) => {
    expect(enlightenmentQualityCap(realm)).toBe(quality);
  });
  it('仙品最低化神、神品最低炼虚，允许预先悟得窗口内更高境界玉简', () => {
    const highBook = (rank: '仙品' | '神品'): InventoryItem => ({
      ...item(),
      instanceData: { name: '高阶典籍', type: 'gongfa_manual', rank },
    });
    expect(enlightenmentMaterialProblem(highBook('仙品'), '元婴')).toBe(
      '需化神境界',
    );
    expect(enlightenmentMaterialProblem(highBook('仙品'), '化神')).toBeNull();
    expect(enlightenmentMaterialProblem(highBook('神品'), '化神')).toBe(
      '需炼虚境界',
    );
    expect(enlightenmentMaterialProblem(highBook('神品'), '炼虚')).toBeNull();
    const xian = prepareEnlightenment([highBook('仙品')], [ref], '化神', 1)
      .preview.probabilities;
    expect(xian[4]).toBeGreaterThan(xian[5]);
    expect(xian[5]).toBeGreaterThan(xian[6]);
    const shen = prepareEnlightenment([highBook('神品')], [ref], '炼虚', 1)
      .preview.probabilities;
    expect(shen[5]).toBeGreaterThan(shen[6]);
    expect(shen[6]).toBeGreaterThan(shen[7]);
  });
  it('地天仙神沿三境窗口上移，混低品不放大高境产出', () => {
    const windows = [
      ['地品', 2, 4],
      ['天品', 3, 5],
      ['仙品', 4, 6],
      ['神品', 5, 7],
    ] as const;
    for (const [quality, first, last] of windows) {
      const single = previewEnlightenment([quality], 1);
      const full = previewEnlightenment([quality, '凡品', '凡品', '凡品'], 1);
      const distribution = enlightenmentDistribution(quality);
      for (let realm = 0; realm < ENLIGHTENMENT_REALMS.length; realm++) {
        if (realm >= first && realm <= last) {
          expect(distribution[realm]).toBeGreaterThan(0);
          expect(full.probabilities[realm]).toBeCloseTo(
            single.probabilities[realm],
            12,
          );
          if (realm < last)
            expect(distribution[realm]).toBeGreaterThan(distribution[realm + 1]);
        } else {
          expect(distribution[realm]).toBe(0);
        }
      }
      expect(full.successChance).toBe(1);
    }
  });
  it('灵气按1至8线性累加，感悟折扣合计向上取整并至少1点', () => {
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
    expect(previewEnlightenment(['仙品', '神品'], 1).cost).toEqual({
      qi: 15,
      baseInsight: 52,
      insight: 52,
    });
    expect(
      previewEnlightenment(['神品', '神品', '神品', '神品'], 0.8).cost,
    ).toEqual({
      qi: 32,
      baseInsight: 128,
      insight: 103,
    });
  });
  it('八个境界共48本功法均可通过悟道获得', () => {
    const ids = new Set<string>();
    for (const quality of ENLIGHTENMENT_QUALITIES) {
      const preview = previewEnlightenment(
        [quality, quality, quality, quality],
        1,
      );
      let cumulative = 0;
      for (let r = 0; r < ENLIGHTENMENT_REALMS.length; r++) {
        const probability = preview.probabilities[r];
        if (probability > 0) {
          const pool = CHARACTER_MANUALS_V1.filter(
            (manual) => manual.realm === ENLIGHTENMENT_REALMS[r],
          );
          expect(pool).toHaveLength(6);
          for (const [i, manual] of pool.entries()) {
            const rolls = [
              cumulative + probability / 2,
              (i + 0.5) / pool.length,
            ];
            const jade = rollEnlightenment(preview, () => rolls.shift()!);
            expect(jade).toBe(`jade.${manual.id}`);
            ids.add(jade!);
          }
        }
        cumulative += probability;
      }
    }
    expect(ids.size).toBe(48);
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
  it('允许混合消耗储物袋与储藏室典籍，产出仍须预留储物袋空位', () => {
    const storageBook: InventoryItem = {
      ...item(1),
      id: 'stored-book',
      location: 'storage',
      slotIndex: null,
    };
    const before = [item(1), storageBook];
    const prepared = prepareEnlightenment(
      before,
      [
        { id: 'book', revision: 0, quantity: 1 },
        { id: 'stored-book', revision: 0, quantity: 1 },
      ],
      '炼气',
      1,
    );
    expect(prepared.afterMaterials).toEqual([]);
    expect(prepared.preview.successChance).toBe(0.5);
  });
  it.each(['仙品', '神品'] as const)(
    '%s预检所有高境玉简，已有同名堆叠不能绕过容量检查',
    (quality) => {
      const jade = CHARACTER_MANUALS_V1.find(
        (manual) => manual.realm === (quality === '仙品' ? '化神' : '合体'),
      )!;
      const definitionId = `jade.${jade.id}`;
      const bag = [
        {
          ...item(5),
          instanceData: {
            name: '高阶典籍',
            type: 'gongfa_manual' as const,
            rank: quality,
          },
        },
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
      const realm = quality === '仙品' ? '化神' : '合体';
      expect(() => prepareEnlightenment(bag, [ref], realm, 1)).toThrow('空位');
      bag[0].quantity = 4;
      expect(
        prepareEnlightenment(bag, [ref], realm, 1).afterMaterials,
      ).toHaveLength(39);
    },
  );
});
