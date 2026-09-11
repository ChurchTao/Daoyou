import type { InventoryItem } from '@shared/inventory';
import { describe, expect, it } from 'vitest';
import { consumeDungeonMaterials } from './materialCosts';

const material = (
  id: string,
  quantity: number,
  rank = '凡品',
  name = '玄铁',
): InventoryItem => ({
  id,
  quantity,
  definitionId: 'material.v1',
  location: 'bag',
  slotIndex: Number(id),
  revision: 0,
  instanceData: { name, type: 'ore', rank, description: '' },
});
describe('秘境背包材料支付', () => {
  it('跨堆叠凑足数量，优先最低品质，保留未消费事实', () => {
    const input = [
      material('0', 2, '玄品'),
      material('1', 2),
      material('2', 3),
    ];
    const result = consumeDungeonMaterials(input, [
      { type: 'material', value: 4, required_type: 'ore' },
    ]);
    expect(
      result.map((item) => [item.id, item.quantity, item.revision]),
    ).toEqual([
      ['0', 2, 0],
      ['2', 1, 1],
    ]);
    expect(input[1].quantity).toBe(2);
  });
  it('先为指定名称保留材料，不让宽泛条件抢占', () => {
    const result = consumeDungeonMaterials(
      [material('0', 1), material('1', 1, '凡品', '青铁')],
      [
        { type: 'material', value: 1, required_type: 'ore' },
        { type: 'material', value: 1, name: '玄铁' },
      ],
    );
    expect(result).toEqual([]);
  });
  it('重叠要求不会重复计数，失败不修改原库存', () => {
    const input = [material('0', 1)];
    expect(() =>
      consumeDungeonMaterials(input, [
        { type: 'material', value: 1 },
        { type: 'material', value: 1 },
      ]),
    ).toThrow('不足');
    expect(input[0].quantity).toBe(1);
  });
  it('storage不参与；名称、类型、最低品质同时匹配', () => {
    const input = [
      material('0', 2),
      {
        ...material('1', 9, '玄品'),
        location: 'storage' as const,
        slotIndex: null,
      },
    ];
    expect(() =>
      consumeDungeonMaterials(input, [
        { type: 'material', value: 1, name: '玄铁', required_quality: '玄品' },
      ]),
    ).toThrow('不足');
    expect(() =>
      consumeDungeonMaterials(input, [
        { type: 'material', value: 1, name: '玄铁', required_type: 'herb' },
      ]),
    ).toThrow('不足');
  });
  it('固定掉落材料与转换材料都可以支付', () => {
    const fixed = {
      ...material('0', 1),
      definitionId: 'material.ore.qingxi-iron.v1',
      instanceData: undefined,
    };
    expect(
      consumeDungeonMaterials(
        [fixed, material('1', 1)],
        [{ type: 'material', value: 2, required_type: 'ore' }],
      ),
    ).toEqual([]);
  });
});
