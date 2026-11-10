import type { Quality } from '@daoyou/constants/qualities';
import { describe, expect, it } from 'vitest';
import { rollMarketMaterialStock } from './material-stock.js';

const ranges: Array<[Quality, number, number]> = [
  ['凡品', 20, 30],
  ['灵品', 10, 15],
  ['玄品', 5, 8],
  ['真品', 2, 3],
  ['地品', 1, 2],
  ['天品', 1, 1],
  ['仙品', 1, 1],
  ['神品', 1, 1],
];

describe('坊市基础材料整叠货品', () => {
  it.each(ranges)(
    '%s 数量在 %i～%i 的闭区间内波动并按整叠计价',
    (rank, min, max) => {
      const material = { type: 'herb' as const, rank, price: 37 };
      expect(rollMarketMaterialStock(material, () => 0)).toEqual({
        quantity: min,
        price: 37 * min,
      });
      expect(rollMarketMaterialStock(material, () => 0.999999)).toEqual({
        quantity: max,
        price: 37 * max,
      });
      for (let quantity = min; quantity <= max; quantity++) {
        const roll = (quantity - min + 0.5) / (max - min + 1);
        expect(rollMarketMaterialStock(material, () => roll)).toEqual({
          quantity,
          price: 37 * quantity,
        });
      }
      expect(material.price).toBe(37);
    },
  );

  it.each(['herb', 'ore', 'monster', 'aux', 'tcdb'] as const)(
    '%s 基础材料均使用品阶数量规则',
    (type) => {
      expect(
        rollMarketMaterialStock({ type, rank: '凡品', price: 10 }, () => 0.5),
      ).toEqual({ quantity: 25, price: 250 });
    },
  );

  it.each(['seed', 'gongfa_manual', 'skill_manual'] as const)(
    '%s 保持单件和原价',
    (type) => {
      expect(
        rollMarketMaterialStock({ type, rank: '凡品', price: 100 }, () => 0.9),
      ).toEqual({ quantity: 1, price: 100 });
    },
  );

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER])(
    '拒绝无效或溢出的价格 %s',
    (price) => {
      expect(() =>
        rollMarketMaterialStock({ type: 'herb', rank: '凡品', price }, () => 0),
      ).toThrow('坊市材料售价无效');
    },
  );
});
