import type { Material } from '@shared/types/cultivator';
import { calculateDungeonExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerInfo } from '../types';
import { RewardFactory } from './RewardFactory';

describe('RewardFactory', () => {
  it('为副本产出的炼丹材料保留纯文本信息，不再写旧药性画像', () => {
    const [reward] = RewardFactory.materialize(
      [
        {
          name: '青纹回元草',
          description: '木气温润的灵草，可调和炉势并稳住药力。',
          element: '木',
        },
      ],
      '筑基',
      'A',
      40,
    );

    expect(reward.type).toBe('material');

    const material = reward.data as Material;
    expect(material.type).toBe('herb');
    expect(material.details).toBeUndefined();
  });

  it('为非炼丹材料仍保留空详情', () => {
    const [reward] = RewardFactory.materialize(
      [
        {
          name: '裂碑秘卷',
          description: '残缺秘术玉简，记有碎碑裂罡之法。',
          material_type: 'skill_manual',
          element: '金',
        },
      ],
      '筑基',
      'A',
      40,
    );

    expect(reward.type).toBe('material');

    const material = reward.data as Material;
    expect(material.type).toBe('skill_manual');
    expect(material.details).toBeUndefined();
  });

  it('副本奖励不再把炼体语义蓝图归一成预设材料', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95);

    try {
      const [reward] = RewardFactory.materialize(
        [
          {
            name: '雷击药浴残液',
            description: '可用于皮膜筋膜破限，药性仍有雷火余威。',
            material_type: 'aux',
            element: '水',
            reward_score: 90,
          },
        ],
        '炼气',
        'S',
        60,
      );

      expect(reward.type).toBe('material');
      expect(reward.name).toBe('雷击药浴残液');

      const material = reward.data as Material;
      expect(material).toMatchObject({
        name: '雷击药浴残液',
        type: 'aux',
        element: '水',
      });
      expect(material.description).toBe(
        '可用于皮膜筋膜破限，药性仍有雷火余威。',
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('不会用炼体关键词覆盖显式神通秘术掉落', () => {
    const [reward] = RewardFactory.materialize(
      [
        {
          name: '金身搏杀秘卷',
          description: '记载体修金身爆发的残缺神通。',
          material_type: 'skill_manual',
          element: '金',
          reward_score: 90,
        },
      ],
      '元婴',
      'S',
      60,
    );

    const material = reward.data as Material;
    expect(material.name).toBe('金身搏杀秘卷');
    expect(material.type).toBe('skill_manual');
  });

  it('副本基础修为使用统一 dungeon 场景预算', () => {
    const playerInfo: PlayerInfo = {
      name: '韩立',
      realm: '筑基 初期',
      gender: '男',
      age: 30,
      lifespan: 180,
      personality: '谨慎',
      attributes: {
        vitality: 40,
        spirit: 36,
        wisdom: 30,
        speed: 28,
        willpower: 32,
      },
      spiritual_roots: ['木(80)'],
      fates: [],
      skills: [],
      spirit_stones: 0,
      background: '',
      resourceCaps: {
        maxHp: 100,
        maxMp: 100,
      },
    };

    const rewards = RewardFactory.generateBaseRewards(
      '筑基',
      'S',
      0,
      playerInfo,
    );
    const expReward = rewards.find((reward) => reward.type === 'cultivation_exp');

    expect(expReward?.value).toBe(
      calculateDungeonExp('筑基', '初期', 'S', 0),
    );
  });

  it('副本修为叠加评级、危险度和副本难度倍率', () => {
    const playerInfo: PlayerInfo = {
      name: '韩立',
      realm: '化神 初期',
      gender: '男',
      age: 300,
      lifespan: 1_000,
      personality: '谨慎',
      attributes: {
        vitality: 80,
        spirit: 76,
        wisdom: 70,
        speed: 68,
        willpower: 72,
      },
      spiritual_roots: ['木(90)'],
      fates: [],
      skills: [],
      spirit_stones: 0,
      background: '',
      resourceCaps: {
        maxHp: 100,
        maxMp: 100,
      },
    };

    const rewards = RewardFactory.generateBaseRewards(
      '化神',
      'S',
      100,
      playerInfo,
      'boss',
    );
    const expReward = rewards.find((reward) => reward.type === 'cultivation_exp');

    expect(expReward?.value).toBe(4_752);
  });

  it('按副本档位加成灵石、修为和感悟，不影响材料生成入口', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const playerInfo: PlayerInfo = {
      name: '韩立',
      realm: '筑基 初期',
      gender: '男',
      age: 30,
      lifespan: 180,
      personality: '谨慎',
      attributes: {
        vitality: 40,
        spirit: 36,
        wisdom: 30,
        speed: 28,
        willpower: 32,
      },
      spiritual_roots: ['木(80)'],
      fates: [],
      skills: [],
      spirit_stones: 0,
      background: '',
      resourceCaps: {
        maxHp: 100,
        maxMp: 100,
      },
    };

    try {
      const easyRewards = RewardFactory.generateBaseRewards(
        '筑基',
        'S',
        0,
        playerInfo,
        'easy',
      );
      const bossRewards = RewardFactory.generateBaseRewards(
        '筑基',
        'S',
        0,
        playerInfo,
        'boss',
      );

      const easySpiritStones = easyRewards.find(
        (reward) => reward.type === 'spirit_stones',
      );
      const bossSpiritStones = bossRewards.find(
        (reward) => reward.type === 'spirit_stones',
      );
      const easyExp = easyRewards.find(
        (reward) => reward.type === 'cultivation_exp',
      );
      const bossExp = bossRewards.find(
        (reward) => reward.type === 'cultivation_exp',
      );
      const easyInsight = easyRewards.find(
        (reward) => reward.type === 'comprehension_insight',
      );
      const bossInsight = bossRewards.find(
        (reward) => reward.type === 'comprehension_insight',
      );

      expect(bossSpiritStones?.value).toBe(
        Math.floor((easySpiritStones?.value ?? 0) * 1.5),
      );
      expect(bossExp?.value).toBe(
        Math.floor((easyExp?.value ?? 0) * 1.5),
      );
      expect(bossInsight?.value).toBe(
        Math.floor((easyInsight?.value ?? 0) * 1.5),
      );

      const aRewards = RewardFactory.generateBaseRewards(
        '筑基',
        'A',
        0,
        playerInfo,
        'normal',
      );
      expect(
        aRewards.find((reward) => reward.type === 'comprehension_insight')
          ?.value,
      ).toBeGreaterThan(0);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
