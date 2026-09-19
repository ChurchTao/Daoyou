import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { ITEM_DEFINITIONS } from '../items/registry';
import { TOWER_ELIGIBLE_REALMS } from '../lib/tower/helpers';
import raw from './data/tower.json';
import schema from './data/tower.schema.json';
import { planTowerReward } from './tower';
import { TowerRewardPackShape, loadTowerRewardPack } from './tower-pack';

describe('幻境里程碑奖励配置', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(TowerRewardPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));

  it('各境界保留四档奖励数量和资源，材料使用挑战境界', () => {
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      expect(planTowerReward(1, 8, realm)).toBeNull();
      for (const [floor, count, stones, reputation] of [
        [5, 1, 5, 5],
        [10, 2, 10, 10],
        [15, 3, 15, 15],
        [20, 4, 20, 20],
      ]) {
        expect(planTowerReward(floor, 8, realm)).toMatchObject({
          floor,
          materialCount: count,
          materialRealm: realm,
          spiritStones: combatCharacterLevel(realm, '初期') * stones,
          reputation,
        });
      }
    }
  });

  it('奖励身份稳定，不同战局种子与楼层隔离材料抽取', () => {
    const reward = planTowerReward(5, 8, '金丹')!;
    expect(reward).toEqual(planTowerReward(5, 8, '金丹'));
    expect(reward.materialSeed).not.toBe(
      planTowerReward(5, 9, '金丹')!.materialSeed,
    );
    expect(reward.materialSeed).not.toBe(
      planTowerReward(10, 8, '金丹')!.materialSeed,
    );
  });

  it('数量与经济配置进入奖励计划', () => {
    const data = structuredClone(raw);
    data.milestones.C.quantity = 3;
    data.milestones.C.spiritStonesPerLevel *= 2;
    data.milestones.C.reputation = 9;
    const reward = planTowerReward(5, 8, '金丹', loadTowerRewardPack(data))!;
    expect(reward.materialCount).toBe(3);
    expect(reward.spiritStones).toBe(
      planTowerReward(5, 8, '金丹')!.spiritStones * 2,
    );
    expect(reward.reputation).toBe(9);
  });

  it('拒绝固定材料池和超过库存交付范围的数量', () => {
    expect(() => loadTowerRewardPack({ ...raw, materials: [] })).toThrow(
      'materials',
    );
    for (const quantity of [0, 100]) {
      const data = structuredClone(raw);
      data.milestones.C.quantity = quantity;
      expect(() => loadTowerRewardPack(data)).toThrow('quantity');
    }
  });

  it('材料仅保留通用实例定义', () => {
    expect(
      ITEM_DEFINITIONS.filter((item) => item.kind === 'material').map(
        (item) => item.id,
      ),
    ).toEqual(['material.v1']);
  });
});
