import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SeededRng } from '../engine/combat-v6/core/rng';
import raw from './data/wild.json';
import schema from './data/wild.schema.json';
import { WildRewardPackShape, compileWildRewardPool, loadWildRewardPack } from './wild-pack';
import { QINGXI_POOL_V2, wildItemRewards } from './wild';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
describe('野外奖励数据包', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(WildRewardPackShape, { reused: 'ref' })).toEqual(schema));
  it('完整奖励池和512种子实际物品保持迁移前结果', () => {
    expect(hash(QINGXI_POOL_V2)).toBe('c4f2ffcaed4ed572ee2612ad44828e12acf9c9767f43fa787aaf8ffe5ece9ef3');
    const outputs = Array.from({ length: 512 }, (_, seed) => {
      const rng = new SeededRng(seed);
      return wildItemRewards(QINGXI_POOL_V2, () => () => rng.next(), group => `baseline-${seed}-${group}`, '2026-09-11T00:00:00Z');
    });
    expect(hash(outputs)).toBe('4e251b663058178f24e3c1bd5059b3500a21e8f1c88a213f288c30b21e296af6');
  });
  it('配置等级、概率和部位控制最终奖励', () => {
    const data = structuredClone(raw);
    data.equipmentLevels = [30];
    data.groups = [{ id: 'blueprints', chance: 1, source: { kind: 'blueprints', slots: ['head'] } }];
    const pool = compileWildRewardPool(loadWildRewardPack(data));
    expect(wildItemRewards(pool, () => () => 0, () => 'unused', '')).toEqual([{ definitionId: 'blueprint.head.30', quantity: 1 }]);
    data.groups[0].chance = 0;
    expect(wildItemRewards(compileWildRewardPool(loadWildRewardPack(data)), () => () => 0.5, () => 'unused', '')).toEqual([]);
  });
  it('拒绝未知区域、奖励、重复组和非法数量', () => {
    const region = structuredClone(raw);
    region.nodeId = 'missing';
    expect(() => loadWildRewardPack(region)).toThrow('区域');
    const invalid = { ...raw, groups: [{ id: 'test', chance: 1, source: { kind: 'fixed', entries: [{ rewardId: 'missing', weight: 1, quantity: { min: 1, max: 1 } }] } }] };
    expect(() => loadWildRewardPack(invalid)).toThrow('奖励引用');
    invalid.groups[0].source.entries[0].rewardId = 'equipment.head.10';
    invalid.groups[0].source.entries[0].quantity.max = 2;
    expect(() => loadWildRewardPack(invalid)).toThrow('奖励引用');
    const duplicate = structuredClone(raw);
    duplicate.groups.push(duplicate.groups[0]);
    expect(() => loadWildRewardPack(duplicate)).toThrow();
  });
});
