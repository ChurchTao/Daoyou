import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tower.json';
import schema from './data/tower.schema.json';
import { TowerRewardPackShape, loadTowerRewardPack } from './tower-pack';
import { towerReward } from './tower';
import { TOWER_ELIGIBLE_REALMS } from '../lib/tower/helpers';

describe('幻境里程碑奖励配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TowerRewardPackShape, { reused: 'ref' })).toEqual(schema));
  it('七境界×五楼层×128种子产出与迁移前相同', () => {
    const outcomes = TOWER_ELIGIBLE_REALMS.flatMap(realm => [1, 5, 10, 15, 20].flatMap(floor => Array.from({ length: 128 }, (_, seed) => towerReward(floor, seed, realm))));
    expect(createHash('sha256').update(JSON.stringify(outcomes)).digest('hex')).toBe('06415eec0039a6718a4f728642f852e5ee709ee60e9dad5a1b3da13331395aa2');
  });
  it('修改材料池、数量与经济参数直接影响产出', () => {
    const data = structuredClone(raw);
    data.materials = [data.materials[1]];
    data.milestones.C.quantity = 3;
    data.milestones.C.spiritStonesPerLevel *= 2;
    data.milestones.C.reputation = 9;
    const reward = towerReward(5, 8, '金丹', loadTowerRewardPack(data))!;
    expect(reward.items).toEqual([{ definitionId: data.materials[0].rewardId, quantity: 3 }]);
    expect(reward.spiritStones).toBe(towerReward(5, 8, '金丹')!.spiritStones * 2);
    expect(reward.reputation).toBe(9);
  });
  it('拒绝非法材料和重复引用', () => {
    const missing = structuredClone(raw);
    missing.materials[0].rewardId = 'unknown';
    expect(() => loadTowerRewardPack(missing)).toThrow('材料引用');
    const duplicate = structuredClone(raw);
    duplicate.materials.push(duplicate.materials[0]);
    expect(() => loadTowerRewardPack(duplicate)).toThrow('重复');
  });
});
