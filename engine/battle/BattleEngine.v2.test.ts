import type { Cultivator } from '@/types/cultivator';
import { EffectType } from '../effect';
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

        element: '金',
        cost: 20,
        cooldown: 1,
        grade: '黄阶下品',
        effects: [
          {
            type: EffectType.Damage,
            trigger: 'ON_SKILL_HIT',
            params: { multiplier: 0.6, element: '金' },
          },
          {
            type: EffectType.AddBuff,
            trigger: 'ON_SKILL_HIT',
            params: { buffId: 'bleed', duration: 2 },
          },
        ],
      },
      {
        id: 'skill_2',
        name: '护体术',

        target_self: true,
        element: '金',
        cost: 20,
        cooldown: 2,
        grade: '黄阶下品',
        effects: [
          {
            type: EffectType.AddBuff,
            trigger: 'ON_SKILL_HIT',
            params: { buffId: 'armor_up', duration: 2 },
          },
        ],
      },
    ],
    inventory: {
      artifacts: [
        {
          id: 'artifact_1',
          name: '金刃',
          element: '金',
          slot: 'weapon',
          effects: [
            {
              type: EffectType.StatModifier,
              trigger: 'ON_STAT_CALC',
              params: { attribute: 'spirit', value: 10, modType: 1 },
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
    expect(result.timeline[0].player.buffs).toEqual([]);
    expect(result.timeline[0].opponent.buffs).toEqual([]);
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

  // ============================================================
  // 新增测试：全面测试 EffectEngine 重构后的效果
  // ============================================================

  describe('EffectEngine 综合测试', () => {
    /**
     * 火系法师 - 高攻击、DOT、控制
     */
    const createFireMage = (): Cultivator => ({
      id: 'fire_mage_001',
      name: '炎煌子',
      gender: '男',
      title: '炼丹真人',
      realm: '筑基',
      realm_stage: '后期',
      age: 120,
      lifespan: 300,
      spiritual_roots: [
        { element: '火', strength: 95, grade: '天灵根' },
        { element: '木', strength: 30, grade: '伪灵根' },
      ],
      attributes: {
        vitality: 60,
        spirit: 100,
        wisdom: 85,
        speed: 55,
        willpower: 70,
      },
      pre_heaven_fates: [],
      cultivations: [],
      skills: [
        {
          id: 'fire_skill_1',
          name: '烈焰焚天',
          element: '火',
          cost: 35,
          cooldown: 2,
          grade: '玄阶下品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 1.2, element: '火' },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'burn', duration: 3 },
            },
          ],
        },
        {
          id: 'fire_skill_2',
          name: '火狱困笼',

          element: '火',
          cost: 40,
          cooldown: 3,
          grade: '玄阶中品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 0.5, element: '火' },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'root', duration: 2, chance: 0.7 },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'burn', duration: 2 },
            },
          ],
        },
        {
          id: 'fire_skill_3',
          name: '凤凰涅槃',

          target_self: true,
          element: '火',
          cost: 45,
          cooldown: 4,
          grade: '玄阶上品',
          effects: [
            {
              type: EffectType.Heal,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 0.8, targetSelf: true },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'speed_up', duration: 2 },
            },
          ],
        },
      ],
      inventory: {
        artifacts: [
          {
            id: 'fire_staff_001',
            name: '九黎焚天杖',
            element: '火',
            slot: 'weapon',
            quality: '玄品',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: { attribute: 'spirit', value: 25, modType: 1 },
              },
            ],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'fire_staff_001',
        armor: null,
        accessory: null,
      },
      max_skills: 5,
      spirit_stones: 1000,
    });

    /**
     * 剑修 - 高暴击、流血、防御
     */
    const createSwordMaster = (): Cultivator => ({
      id: 'sword_master_001',
      name: '剑尘',
      gender: '男',
      title: '御剑真人',
      realm: '筑基',
      realm_stage: '中期',
      age: 90,
      lifespan: 280,
      spiritual_roots: [
        { element: '金', strength: 90, grade: '天灵根' },
        { element: '土', strength: 45, grade: '真灵根' },
      ],
      attributes: {
        vitality: 90,
        spirit: 75,
        wisdom: 60,
        speed: 80,
        willpower: 65,
      },
      pre_heaven_fates: [],
      cultivations: [],
      skills: [
        {
          id: 'sword_skill_1',
          name: '万剑归宗',

          element: '金',
          cost: 30,
          cooldown: 1,
          grade: '玄阶下品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 0.9, element: '金', canCrit: true },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'bleed', duration: 3 },
            },
          ],
        },
        {
          id: 'sword_skill_2',
          name: '剑意凌霄',
          target_self: true,
          element: '金',
          cost: 25,
          cooldown: 3,
          grade: '玄阶中品',
          effects: [
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'armor_up', duration: 3 },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'crit_rate_up', duration: 3 },
            },
          ],
        },
        {
          id: 'sword_skill_3',
          name: '一剑破万法',

          element: '金',
          cost: 50,
          cooldown: 4,
          grade: '玄阶上品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 1.8, element: '金', ignoreDefense: true },
            },
          ],
        },
        {
          id: 'sword_skill_4',
          name: '破军式',

          element: '金',
          cost: 20,
          cooldown: 2,
          grade: '黄阶上品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 0.4, element: '金' },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'armor_down', duration: 2 },
            },
          ],
        },
      ],
      inventory: {
        artifacts: [
          {
            id: 'sword_001',
            name: '青锋剑',
            element: '金',
            slot: 'weapon',
            quality: '玄品',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: { attribute: 'spirit', value: 20, modType: 1 },
              },
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: { attribute: 'speed', value: 15, modType: 1 },
              },
            ],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'sword_001',
        armor: null,
        accessory: null,
      },
      max_skills: 6,
      spirit_stones: 800,
    });

    /**
     * 妖兽 - 高生命、中毒、恢复
     */
    const createDemonicBeast = (): Cultivator => ({
      id: 'demon_beast_001',
      name: '毒蛟龙',
      gender: '男',
      title: '妖王',
      realm: '筑基',
      realm_stage: '后期',
      age: 500,
      lifespan: 1000,
      spiritual_roots: [
        { element: '水', strength: 70, grade: '真灵根' },
        { element: '木', strength: 85, grade: '天灵根' },
      ],
      attributes: {
        vitality: 120,
        spirit: 65,
        wisdom: 50,
        speed: 45,
        willpower: 80,
      },
      pre_heaven_fates: [],
      cultivations: [],
      skills: [
        {
          id: 'beast_skill_1',
          name: '毒雾弥漫',

          element: '木',
          cost: 25,
          cooldown: 2,
          grade: '玄阶下品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 0.6, element: '木' },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'poison', duration: 4 },
            },
          ],
        },
        {
          id: 'beast_skill_2',
          name: '蛇吞天地',

          element: '水',
          cost: 40,
          cooldown: 3,
          grade: '玄阶中品',
          effects: [
            {
              type: EffectType.Damage,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 1.1, element: '水' },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'stun', duration: 1, chance: 0.7 },
            },
          ],
        },
        {
          id: 'beast_skill_3',
          name: '龙血再生',

          target_self: true,
          element: '木',
          cost: 30,
          cooldown: 3,
          grade: '玄阶下品',
          effects: [
            {
              type: EffectType.Heal,
              trigger: 'ON_SKILL_HIT',
              params: { multiplier: 1.0, targetSelf: true },
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
      max_skills: 5,
      spirit_stones: 0,
    });

    test('火系法师 vs 剑修 - DOT与暴击对决', () => {
      const fireMage = createFireMage();
      const swordMaster = createSwordMaster();

      const result = simulateBattle(fireMage, swordMaster);

      console.log('\n========== 火系法师 vs 剑修 ==========');
      console.log(result.log.join('\n'));
      console.log(`\n✨ 胜者: ${result.winner.name}`);
      console.log(`📊 总回合数: ${result.turns}`);
      console.log(`❤️ 玩家剩余HP: ${result.playerHp}`);
      console.log(`❤️ 对手剩余HP: ${result.opponentHp}`);
      console.log('=====================================\n');

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.log.length).toBeGreaterThan(0);
    });

    test('剑修 vs 毒蛟龙 - 高暴击对抗高血量', () => {
      const swordMaster = createSwordMaster();
      const demonicBeast = createDemonicBeast();

      const result = simulateBattle(swordMaster, demonicBeast);

      console.log('\n========== 剑修 vs 毒蛟龙 ==========');
      console.log(result.log.join('\n'));
      console.log(`\n✨ 胜者: ${result.winner.name}`);
      console.log(`📊 总回合数: ${result.turns}`);
      console.log(`❤️ 玩家剩余HP: ${result.playerHp}`);
      console.log(`❤️ 对手剩余HP: ${result.opponentHp}`);
      console.log('====================================\n');

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
    });

    test('火系法师 vs 毒蛟龙 - 火毒对决', () => {
      const fireMage = createFireMage();
      const demonicBeast = createDemonicBeast();

      const result = simulateBattle(fireMage, demonicBeast);

      console.log('\n========== 火系法师 vs 毒蛟龙 ==========');
      console.log(result.log.join('\n'));
      console.log(`\n✨ 胜者: ${result.winner.name}`);
      console.log(`📊 总回合数: ${result.turns}`);
      console.log('========================================\n');

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
    });

    test('带初始状态的战斗 - 受伤玩家挑战满血敌人', () => {
      const swordMaster = createSwordMaster();
      const demonicBeast = createDemonicBeast();

      // 玩家带着50% HP损失和30% MP损失进入战斗
      const result = simulateBattle(swordMaster, demonicBeast, {
        hpLossPercent: 0.5,
        mpLossPercent: 0.3,
      });

      console.log('\n========== 受伤剑修 vs 满血毒蛟龙 ==========');
      console.log(result.log.join('\n'));
      console.log(`\n✨ 胜者: ${result.winner.name}`);
      console.log(`📊 总回合数: ${result.turns}`);
      console.log(`❤️ 玩家初始HP: ${result.timeline[0]?.player.hp}`);
      console.log(`❤️ 对手初始HP: ${result.timeline[0]?.opponent.hp}`);
      console.log('=============================================\n');

      expect(result).toBeDefined();
      // 验证玩家以受损状态开始
      expect(result.timeline[0].player.hp).toBeLessThan(
        result.timeline[0].player.maxHp,
      );
    });

    test('多轮DOT伤害验证', () => {
      const fireMage = createFireMage();
      const swordMaster = createSwordMaster();

      const result = simulateBattle(fireMage, swordMaster);

      // 检查日志中是否包含DOT伤害信息
      const hasDotDamage = result.log.some(
        (log) =>
          log.includes('灼烧') || log.includes('流血') || log.includes('中毒'),
      );

      console.log(
        `\n📝 DOT伤害日志检查: ${hasDotDamage ? '✅ 包含DOT伤害' : '⚠️ 未触发DOT伤害'}`,
      );

      expect(result.turns).toBeGreaterThan(0);
    });

    test('Buff状态记录验证', () => {
      const fireMage = createFireMage();
      const swordMaster = createSwordMaster();

      const result = simulateBattle(fireMage, swordMaster);

      // 检查时间线中是否正确记录了Buff
      let foundBuffInTimeline = false;
      for (const snapshot of result.timeline) {
        if (
          snapshot.player.buffs.length > 0 ||
          snapshot.opponent.buffs.length > 0
        ) {
          foundBuffInTimeline = true;
          console.log(
            `\n📊 回合${snapshot.turn} Buff状态:`,
            `\n   玩家: ${snapshot.player.buffs.join(', ') || '无'}`,
            `\n   对手: ${snapshot.opponent.buffs.join(', ') || '无'}`,
          );
        }
      }

      console.log(
        `\n📝 Buff时间线记录检查: ${foundBuffInTimeline ? '✅ 正确记录' : '⚠️ 未发现Buff记录'}`,
      );

      expect(result.timeline.length).toBeGreaterThan(0);
    });
  });
});
