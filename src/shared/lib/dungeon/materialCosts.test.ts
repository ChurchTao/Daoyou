import type { DungeonMaterialSelection } from '@shared/contracts/combatV6Dungeon';
import type { InventoryItem } from '@shared/inventory';
import { describe, expect, it } from 'vitest';
import { consumeDungeonMaterials } from './materialCosts';
import type { DungeonOptionCost } from './types';

const material = (
  id: string,
  quantity: number,
  rank = '凡品',
): InventoryItem => ({
  id,
  quantity,
  definitionId: 'material.v1',
  location: 'bag',
  slotIndex: 0,
  revision: 2,
  instanceData: { name: '玄铁', type: 'ore', rank, description: '' },
});
const cost: DungeonOptionCost = {
  type: 'material',
  value: 2,
  required_type: 'ore',
};
const select = (
  itemId: string,
  quantity: number,
  costIndex = 0,
): DungeonMaterialSelection => ({
  costIndex,
  items: [{ itemId, quantity, revision: 2 }],
});

describe('秘境自主选材', () => {
  it('仅扣玩家选择的高品质材料，保留低品质材料', () => {
    const input = [material('low', 5), material('high', 3, '玄品')];
    const result = consumeDungeonMaterials(input, [cost], [select('high', 2)]);
    expect(result.map((i) => [i.id, i.quantity, i.revision])).toEqual([
      ['low', 5, 2],
      ['high', 1, 3],
    ]);
    expect(input[1].quantity).toBe(3);
  });
  it('允许跨堆叠精确凑足数量', () => {
    expect(
      consumeDungeonMaterials(
        [material('a', 1), material('b', 1)],
        [cost],
        [
          {
            costIndex: 0,
            items: [...select('a', 1).items, ...select('b', 1).items],
          },
        ],
      ),
    ).toEqual([]);
  });
  it('漏选不自动选材，多交少交均拒绝', () => {
    const input = [material('a', 5)];
    expect(() => consumeDungeonMaterials(input, [cost])).toThrow('选择');
    for (const quantity of [1, 3])
      expect(() =>
        consumeDungeonMaterials(input, [cost], [select('a', quantity)]),
      ).toThrow('一致');
  });
  it('旧revision拒绝，不替换为同类物品', () => {
    expect(() =>
      consumeDungeonMaterials(
        [{ ...material('a', 5), revision: 3 }, material('b', 5)],
        [cost],
        [select('a', 2)],
      ),
    ).toThrow('已变化');
  });
  it('他人或不存在物品、storage、类型与品质不符均拒绝', () => {
    for (const item of [
      undefined,
      { ...material('a', 5), location: 'storage' as const },
      {
        ...material('a', 5),
        instanceData: { name: '草', type: 'herb', rank: '凡品' },
      },
      material('a', 5),
    ]) {
      expect(() =>
        consumeDungeonMaterials(
          item ? [item] : [],
          [{ ...cost, required_quality: '玄品' }],
          [select('a', 2)],
        ),
      ).toThrow('不符合');
    }
    expect(() =>
      consumeDungeonMaterials(
        [material('a', 5)],
        [{ ...cost, name: '青铁' }],
        [select('a', 2)],
      ),
    ).toThrow('不符合');
  });
  it('同一堆叠分配到多个要求时共同核对数量，失败不改输入', () => {
    const input = [material('a', 3)];
    expect(() =>
      consumeDungeonMaterials(
        input,
        [cost, cost],
        [select('a', 2), select('a', 2, 1)],
      ),
    ).toThrow('不足');
    expect(input[0].quantity).toBe(3);
    expect(
      consumeDungeonMaterials(
        [material('a', 4)],
        [cost, cost],
        [select('a', 2), select('a', 2, 1)],
      ),
    ).toEqual([]);
  });
  it('重复要求、重复物品与伪造成本位置拒绝', () => {
    const input = [material('a', 5)];
    expect(() =>
      consumeDungeonMaterials(input, [cost], [select('a', 2), select('a', 2)]),
    ).toThrow('无效');
    expect(() =>
      consumeDungeonMaterials(
        input,
        [cost],
        [
          {
            costIndex: 0,
            items: [...select('a', 1).items, ...select('a', 1).items],
          },
        ],
      ),
    ).toThrow('无效');
    expect(() => consumeDungeonMaterials(input, [], [select('a', 2)])).toThrow(
      '无效',
    );
  });
  it('固定与转换材料可共同提交，不影响无材料成本', () => {
    const fixed = {
      ...material('a', 1),
      definitionId: 'material.ore.qingxi-iron.v1',
      instanceData: undefined,
    };
    expect(
      consumeDungeonMaterials(
        [fixed, material('b', 1)],
        [cost],
        [
          {
            costIndex: 0,
            items: [...select('a', 1).items, ...select('b', 1).items],
          },
        ],
      ),
    ).toEqual([]);
    expect(
      consumeDungeonMaterials([fixed], [{ type: 'spirit_stones', value: 5 }]),
    ).toEqual([fixed]);
  });
});
