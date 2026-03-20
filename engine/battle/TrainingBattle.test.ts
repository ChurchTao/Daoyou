import type { Cultivator } from '@/types/cultivator';
import { EffectType } from '../effect/types';
import { BattleEngineV2 } from './BattleEngine.v2';

describe('Training Room Battle Logic', () => {
  const mockPlayer: Cultivator = {
    id: 'player-1',
    name: '道友',
    gender: '男',
    age: 20,
    lifespan: 100,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [{ element: '金', strength: 50 }],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [
      {
        id: 'basic-atk',
        name: '基础攻击',
        element: '金',
        cooldown: 0,
        effects: [
          {
            type: EffectType.Damage,
            params: { multiplier: 1 },
          },
        ],
      },
    ],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 6,
    spirit_stones: 0,
    realm: '炼气',
    realm_stage: '初期',
  };

  const mockDummy: Cultivator = {
    id: 'dummy',
    name: '木桩',
    age: 0,
    lifespan: 9999,
    attributes: {
      vitality: 1,
      spirit: 1,
      wisdom: 1,
      speed: 1,
      willpower: 1,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 0,
    spirit_stones: 0,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
  };

  it('should end after 10 turns in training mode', () => {
    const engine = new BattleEngineV2();
    const result = engine.simulateBattle(mockPlayer, mockDummy, {
      isTraining: true,
    });

    expect(result.turns).toBeLessThanOrEqual(10);
    expect(result.log.some((l) => l.includes('[第10回合]'))).toBe(true);
    expect(result.log.some((l) => l.includes('[第11回合]'))).toBe(false);
  });
  it('dummy should not attack the player', () => {
    const engine = new BattleEngineV2();
    const result = engine.simulateBattle(mockPlayer, mockDummy, {
      isTraining: true,
    });

    // 过滤出所有关于木桩主动行动的日志
    // 正常战斗日志格式如："道友 对 木桩 使用「基础攻击」，造成 10 点伤害"
    // 如果木桩行动，格式应为："木桩 对 道友 使用..." 或 "木桩 使用..."
    const dummyActions = result.log.filter(
      (l) =>
        l.startsWith('木桩') &&
        (l.includes('使用') || l.includes('造成')) &&
        !l.includes('静立不动'), // 排除静止日志
    );

    expect(dummyActions.length).toBe(0);
    expect(result.log.some((l) => l.includes('木桩静立不动'))).toBe(true);
  });
  it('should not apply injuries in training mode', () => {
    const injuredPlayer = {
      ...mockPlayer,
      attributes: { ...mockPlayer.attributes, vitality: 1 },
    };
    const engine = new BattleEngineV2();
    const result = engine.simulateBattle(injuredPlayer, mockDummy, {
      isTraining: true,
      hpLossPercent: 0.95,
    });

    expect(
      result.log.some((l) => l.includes('受了轻伤') || l.includes('受了重伤')),
    ).toBe(false);
    expect(result.log.some((l) => l.includes('演武结束'))).toBe(true);
  });
});
