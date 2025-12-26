import { simulateBattle } from './BattleEngine.v2';
import type { Cultivator } from '@/types/cultivator';

describe('BattleEngineV2', () => {
  const createMockCultivator = (name: string): Cultivator => ({
    id: name,
    name,
    gender: '男',
    title: '道友',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 100,
    spiritual_roots: [
      {
        element: '金',
        strength: 80,
        grade: '真灵根',
      },
    ],
    attributes: {
      vitality: 50,
      spirit: 50,
      wisdom: 50,
      speed: 50,
      willpower: 50,
    },
    pre_heaven_fates: [],
    cultivations: [],
    skills: [
      {
        id: 'skill_1',
        name: '金刃斩',
        type: 'attack',
        element: '金',
        power: 60,
        cost: 20,
        cooldown: 0,
        grade: '黄阶下品',
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
    max_skills: 5,
    spirit_stones: 0,
  });

  test('应该能够执行基本战斗', () => {
    const player = createMockCultivator('玩家');
    const opponent = createMockCultivator('对手');

    const result = simulateBattle(player, opponent);
    console.log(result);

    expect(result).toBeDefined();
    expect(result.winner).toBeDefined();
    expect(result.loser).toBeDefined();
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.turns).toBeGreaterThan(0);
  });

  test('应该记录初始快照', () => {
    const player = createMockCultivator('玩家');
    const opponent = createMockCultivator('对手');

    const result = simulateBattle(player, opponent);

    expect(result.timeline[0].turn).toBe(0);
    expect(result.timeline[0].player.statuses).toEqual([]);
    expect(result.timeline[0].opponent.statuses).toEqual([]);
  });

  test('应该支持初始状态设置', () => {
    const player = createMockCultivator('玩家');
    const opponent = createMockCultivator('对手');

    const initialHp = 100;
    const initialMp = 50;

    const result = simulateBattle(player, opponent, {
      hp: initialHp,
      mp: initialMp,
    });

    expect(result.timeline[0].player.hp).toBe(initialHp);
    expect(result.timeline[0].player.mp).toBe(initialMp);
  });

  test('应该在回合限制内结束战斗', () => {
    const player = createMockCultivator('玩家');
    const opponent = createMockCultivator('对手');

    const result = simulateBattle(player, opponent);

    expect(result.turns).toBeLessThanOrEqual(30);
  });
});
