import type { Cultivator } from '@/types/cultivator';
import { simulateBattle } from './BattleEngine.v2';

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
      vitality: 80,
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
        cooldown: 1,
        effect: 'bleed',
        duration: 2,
        grade: '黄阶下品',
      },
      {
        id: 'skill_2',
        name: '护体术',
        type: 'buff',
        target_self: true,
        element: '金',
        power: 30,
        cost: 20,
        effect: 'armor_up',
        duration: 2,
        cooldown: 2,
        grade: '黄阶下品',
      },
    ],
    inventory: {
      artifacts: [
        {
          id: 'artifact_1',
          name: '金刃',
          element: '金',
          slot: 'weapon',
          bonus: { spirit: 10 },
          special_effects: [
            {
              type: 'on_hit_add_effect',
              effect: 'crit_rate_down',
              chance: 50,
              power: 10,
            },
          ],
        },
      ],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: 'artifact_1',
      // weapon: null,
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
    console.log(result.log);

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

    // 使用损失百分比：30% HP损失，20% MP损失
    const hpLossPercent = 0.3;
    const mpLossPercent = 0.2;

    const result = simulateBattle(player, opponent, {
      hpLossPercent,
      mpLossPercent,
    });

    // 验证：玩家应该以预期的HP/MP开始战斗
    // 注意：具体值取决于角色的maxHp/maxMp
    expect(result.timeline[0].player.hp).toBeLessThan(
      result.timeline[0].player.hp / (1 - hpLossPercent),
    );
    expect(result.timeline[0].player.mp).toBeLessThan(
      result.timeline[0].player.mp / (1 - mpLossPercent),
    );
  });

  test('应该在回合限制内结束战斗', () => {
    const player = createMockCultivator('玩家');
    const opponent = createMockCultivator('对手');

    const result = simulateBattle(player, opponent);

    expect(result.turns).toBeLessThanOrEqual(30);
  });
});
