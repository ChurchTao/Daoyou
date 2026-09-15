import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/dungeon.json';
import schema from './data/dungeon.schema.json';
import { DungeonRewardPackShape, loadDungeonRewardPack } from './dungeon-pack';
import { dungeonReward } from './dungeon';

describe('副本奖励数据包', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(DungeonRewardPackShape, { reused: 'ref' })).toEqual(schema));
  it('三类来源、四档等级、128种子保持迁移前奖励', () => {
    const rows = (['exploration', 'battle', 'completion'] as const).flatMap(source => [1, 60, 120, 180].flatMap(level => Array.from({ length: 128 }, (_, seed) => dungeonReward(seed, `baseline-${seed}`, source, level))));
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe('c184c90a655b4df04f7bd1e726e9b41e4881846fb91f33f321243a9c1b07f918');
  });
  it('材料、数量及经济配置进入最终奖励', () => {
    const data = structuredClone(raw);
    data.materials = [data.materials[2]];
    data.sources.battle = { chance: 1, quantity: 3, experience: 7, stones: 4 };
    expect(dungeonReward(1, 'fight', 'battle', 60, loadDungeonRewardPack(data))).toEqual({
      key: 'fight', items: [{ definitionId: data.materials[0].rewardId, quantity: 3 }], experience: 420, spiritStones: 240,
    });
  });
  it('拒绝未知材料、重复引用、未知来源和非法概率', () => {
    const data = structuredClone(raw);
    data.materials[0].rewardId = 'missing';
    expect(() => loadDungeonRewardPack(data)).toThrow('材料引用');
    expect(() => loadDungeonRewardPack({ ...raw, materials: [raw.materials[0], raw.materials[0]] })).toThrow('重复');
    expect(() => loadDungeonRewardPack({ ...raw, sources: { ...raw.sources, extra: raw.sources.battle } })).toThrow('extra');
    data.materials = structuredClone(raw.materials);
    data.sources.battle.chance = 2;
    expect(() => loadDungeonRewardPack(data)).toThrow('chance');
  });
});
