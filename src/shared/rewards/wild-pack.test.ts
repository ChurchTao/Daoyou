import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BOOKS } from '../items/definitions/beast-books';
import raw from './data/wild.json';
import schema from './data/wild.schema.json';
import { WILD_INHERITANCE_POOL, wildItemRewards } from './wild';
import {
  WildRewardPackShape,
  compileWildRewardPool,
  loadWildRewardPack,
} from './wild-pack';

describe('野外传承灵印奖励包', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(WildRewardPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('完整覆盖灵印且保留3%概率和普通/上品权重', () => {
    const group = WILD_INHERITANCE_POOL.groups[0];
    expect(group.chance).toBe(0.03);
    expect(group.entries.map((e) => e.rewardId)).toEqual(
      BOOKS.map((b) => b.id),
    );
    expect(
      group.entries
        .filter((e) =>
          ['book.beast.combo', 'book.beast.advanced-combo'].includes(
            e.rewardId,
          ),
        )
        .map((e) => e.weight),
    ).toEqual([24, 4]);
    const total = group.entries.reduce((sum, e) => sum + e.weight, 0);
    let offset = 0;
    for (const entry of group.entries) {
      const point = (offset + entry.weight / 2) / total;
      let call = 0;
      expect(
        wildItemRewards(
          WILD_INHERITANCE_POOL,
          () => () => (call++ === 0 ? 0 : point),
        ),
      ).toEqual([{ definitionId: entry.rewardId, quantity: 1 }]);
      offset += entry.weight;
    }
  });
  it('拒绝非灵印、重复引用和额外掉落组', () => {
    for (const id of [
      'missing',
      'material.v1',
      'equipment.head.10',
      'blueprint.head.10',
      'jade.character_manual.changchun',
    ]) {
      const data = structuredClone(raw);
      data.groups[0].source.entries[0].rewardId = id;
      expect(() => loadWildRewardPack(data)).toThrow('传承灵印');
    }
    const duplicate = structuredClone(raw);
    duplicate.groups[0].source.entries.push(
      duplicate.groups[0].source.entries[0],
    );
    expect(() => loadWildRewardPack(duplicate)).toThrow('传承灵印');
    const extra = structuredClone(raw);
    extra.groups.push(extra.groups[0]);
    expect(() => loadWildRewardPack(extra)).toThrow();
  });
  it('关闭灵印掉落概率后无物品奖励', () => {
    const data = structuredClone(raw);
    data.groups[0].chance = 0;
    expect(
      wildItemRewards(
        compileWildRewardPool(loadWildRewardPack(data)),
        () => () => 0.5,
      ),
    ).toEqual([]);
  });
});
