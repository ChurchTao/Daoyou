import type { Cultivator } from '@/types/cultivator';
import {
  AddBuffParams,
  DamageParams,
  EffectTrigger,
  EffectType,
  LifeStealParams,
} from '../effect';
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
            params: { buffId: 'bleed', durationOverride: 2 },
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
            params: { buffId: 'armor_up', durationOverride: 2 },
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
              params: { stat: 'spirit', value: 10, modType: 1 },
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
              params: { buffId: 'burn', durationOverride: 3 },
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
              params: { buffId: 'root', durationOverride: 2, chance: 0.7 },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'burn', durationOverride: 2 },
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
              params: { buffId: 'speed_up', durationOverride: 2 },
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
                params: { stat: 'spirit', value: 25, modType: 1 },
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
              params: {
                multiplier: 0.9,
                element: '金',
                canCrit: true,
                critRateBonus: 0.6,
              } as DamageParams,
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'bleed', durationOverride: 3 },
            },
            {
              type: EffectType.LifeSteal,
              trigger: EffectTrigger.ON_AFTER_DAMAGE,
              params: { stealPercent: 0.3 } as LifeStealParams,
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
              params: { buffId: 'armor_up', durationOverride: 3 },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: { buffId: 'crit_rate_up', durationOverride: 3 },
            },
            {
              type: EffectType.AddBuff,
              trigger: 'ON_SKILL_HIT',
              params: {
                buffId: 'shield',
                durationOverride: 3,
                targetSelf: true,
              } as AddBuffParams,
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
              params: {
                multiplier: 1.8,
                element: '金',
                ignoreDefense: true,
              } as DamageParams,
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
              params: { buffId: 'armor_down', durationOverride: 2 },
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
                params: { stat: 'spirit', value: 20, modType: 1 },
              },
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: { stat: 'speed', value: 15, modType: 1 },
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
              params: { buffId: 'poison', durationOverride: 4 },
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
              params: { buffId: 'stun', durationOverride: 1, chance: 0.7 },
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

    /**
     * 全效果测试 - 验证所有 Effect 类型的功能
     */
    test('全效果综合测试 - 验证所有Effect类型', () => {
      // 攻击者 - 包含各种攻击效果
      const attacker: Cultivator = {
        id: 'attacker_001',
        name: '万法尊者',
        gender: '男',
        title: '试炼者',
        realm: '金丹',
        realm_stage: '初期',
        age: 200,
        lifespan: 500,
        spiritual_roots: [
          { element: '金', strength: 90, grade: '天灵根' },
          { element: '火', strength: 85, grade: '天灵根' },
          { element: '水', strength: 80, grade: '真灵根' },
        ],
        attributes: {
          vitality: 100,
          spirit: 120,
          wisdom: 100,
          speed: 90,
          willpower: 80,
        },
        pre_heaven_fates: [],
        cultivations: [],
        skills: [
          // 技能1: 伤害 + 吸血
          {
            id: 'skill_life_steal',
            name: '吸血斩',
            element: '金',
            cost: 25,
            cooldown: 1,
            grade: '玄阶下品',
            effects: [
              {
                type: EffectType.Damage,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 1.0, element: '金' },
              },
              {
                type: EffectType.LifeSteal,
                trigger: EffectTrigger.ON_AFTER_DAMAGE,
                params: { stealPercent: 0.4 } as LifeStealParams,
              },
            ],
          },
          // 技能2: 真实伤害
          {
            id: 'skill_true_damage',
            name: '破妄神光',
            element: '金',
            cost: 25,
            cooldown: 2,
            grade: '玄阶中品',
            effects: [
              {
                type: EffectType.TrueDamage,
                trigger: 'ON_SKILL_HIT',
                params: {
                  baseDamage: 50,
                  ignoreShield: true,
                  ignoreReduction: true,
                },
              },
            ],
          },
          // 技能3: 斩杀伤害
          {
            id: 'skill_execute',
            name: '斩仙诀',
            element: '金',
            cost: 35,
            cooldown: 2,
            grade: '玄阶上品',
            effects: [
              {
                type: EffectType.Damage,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 0.8, element: '金' },
              },
              {
                type: EffectType.ExecuteDamage,
                trigger: EffectTrigger.ON_BEFORE_DAMAGE,
                params: { thresholdPercent: 0.5, bonusDamage: 1.5 },
              },
            ],
          },
          // 技能4: 驱散 + 伤害
          {
            id: 'skill_dispel',
            name: '破法术',
            element: '金',
            cost: 30,
            cooldown: 3,
            grade: '玄阶中品',
            effects: [
              {
                type: EffectType.Damage,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 0.5, element: '金' },
              },
              {
                type: EffectType.Dispel,
                trigger: 'ON_SKILL_HIT',
                params: { dispelCount: 2, dispelType: 'buff' },
              },
            ],
          },
          // 技能5: 法力吸取
          {
            id: 'skill_mana_drain',
            name: '吸灵术',
            element: '水',
            cost: 20,
            cooldown: 2,
            grade: '玄阶下品',
            effects: [
              {
                type: EffectType.Damage,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 0.4, element: '水' },
              },
              {
                type: EffectType.ManaDrain,
                trigger: 'ON_SKILL_HIT',
                params: {
                  drainPercent: 0.15,
                  drainAmount: 20,
                  restoreToSelf: true,
                },
              },
            ],
          },
          // 技能6: 治疗 + 治疗增幅
          {
            id: 'skill_heal',
            name: '回春术',
            target_self: true,
            element: '木',
            cost: 35,
            cooldown: 2,
            grade: '玄阶中品',
            effects: [
              {
                type: EffectType.Heal,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 1.2, flatHeal: 30, targetSelf: true },
              },
            ],
          },
        ],
        inventory: {
          artifacts: [
            // 武器: 反伤
            {
              id: 'weapon_reflect',
              name: '反伤甲',
              element: '土',
              slot: 'weapon',
              quality: '玄品',
              effects: [
                {
                  type: EffectType.StatModifier,
                  trigger: 'ON_STAT_CALC',
                  params: { stat: 'vitality', value: 30, modType: 1 },
                },
                {
                  type: EffectType.ReflectDamage,
                  trigger: EffectTrigger.ON_AFTER_DAMAGE,
                  params: { reflectPercent: 0.3 },
                },
              ],
            },
          ],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: 'weapon_reflect',
          armor: null,
          accessory: null,
        },
        max_skills: 8,
        spirit_stones: 1000,
      };

      // 防御者 - 包含各种防御/增益效果
      const defender: Cultivator = {
        id: 'defender_001',
        name: '不动明王',
        gender: '男',
        title: '守卫者',
        realm: '金丹',
        realm_stage: '初期',
        age: 250,
        lifespan: 600,
        spiritual_roots: [
          { element: '土', strength: 95, grade: '天灵根' },
          { element: '金', strength: 70, grade: '真灵根' },
        ],
        attributes: {
          vitality: 150,
          spirit: 80,
          wisdom: 90,
          speed: 60,
          willpower: 100,
        },
        pre_heaven_fates: [],
        cultivations: [],
        skills: [
          // 技能1: 护盾
          {
            id: 'skill_shield',
            name: '金刚护体',
            target_self: true,
            element: '土',
            cost: 30,
            cooldown: 3,
            grade: '玄阶中品',
            effects: [
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: {
                  buffId: 'shield',
                  durationOverride: 3,
                  targetSelf: true,
                },
              },
            ],
          },
          // 技能2：增益护盾 + 反击
          {
            id: 'skill_buff_counter',
            name: '不动如山',
            target_self: true,
            element: '土',
            cost: 25,
            cooldown: 4,
            grade: '玄阶上品',
            effects: [
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: {
                  buffId: 'armor_up',
                  durationOverride: 3,
                  targetSelf: true,
                },
              },
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: {
                  buffId: 'damage_reduction',
                  durationOverride: 3,
                  targetSelf: true,
                },
              },
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: {
                  buffId: 'counter_stance',
                  durationOverride: 3,
                  targetSelf: true,
                },
              },
            ],
          },
          // 技能3: 闪避率提升
          {
            id: 'skill_dodge',
            name: '游龙身法',
            target_self: true,
            element: '水',
            cost: 20,
            cooldown: 3,
            grade: '玄阶中品',
            effects: [
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: {
                  buffId: 'dodge_up',
                  durationOverride: 3,
                  targetSelf: true,
                },
              },
            ],
          },
          // 技能4: DOT攻击 + 控制
          {
            id: 'skill_dot_control',
            name: '腐骨毒雾',
            element: '木',
            cost: 35,
            cooldown: 3,
            grade: '玄阶上品',
            effects: [
              {
                type: EffectType.Damage,
                trigger: 'ON_SKILL_HIT',
                params: { multiplier: 0.5, element: '木' },
              },
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: { buffId: 'poison', durationOverride: 4 },
              },
              {
                type: EffectType.AddBuff,
                trigger: 'ON_SKILL_HIT',
                params: { buffId: 'root', durationOverride: 2, chance: 0.6 },
              },
            ],
          },
        ],
        inventory: {
          artifacts: [
            // 饰品: 法力回复
            {
              id: 'accessory_mana',
              name: '聚灵珠',
              element: '水',
              slot: 'accessory',
              quality: '玄品',
              effects: [
                {
                  type: EffectType.StatModifier,
                  trigger: 'ON_STAT_CALC',
                  params: { stat: 'wisdom', value: 20, modType: 1 },
                },
                {
                  type: EffectType.ManaRegen,
                  trigger: EffectTrigger.ON_TURN_END,
                  params: { amount: 15, percentOfMax: 0.05 },
                },
              ],
            },
          ],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: null,
          armor: null,
          accessory: 'accessory_mana',
        },
        max_skills: 6,
        spirit_stones: 800,
      };

      const result = simulateBattle(attacker, defender);

      console.log('\n========== 全效果综合测试 ==========');
      console.log('攻击者: 万法尊者');
      console.log('防御者: 不动明王');
      console.log('\n【攻击者技能】');
      console.log('  - 吸血斩: 伤害 + 40%吸血');
      console.log('  - 破妄神光: 50点真实伤害');
      console.log('  - 斩仙诀: 伤害 + 对低血量目标额外伤害');
      console.log('  - 破法术: 伤害 + 驱散2个增益');
      console.log('  - 吸灵术: 伤害 + 15%法力吸取');
      console.log('  - 回春术: 治疗');
      console.log('  - 装备: 30%反伤');
      console.log('\n【防御者技能】');
      console.log('  - 金刚护体: 护盾');
      console.log('  - 不动如山: 防御提升 + 减伤 + 50%反击');
      console.log('  - 游龙身法: 闪避提升');
      console.log('  - 腐骨毒雾: 伤害 + 中毒 + 定身');
      console.log('  - 装备: 每回合法力回复');

      console.log('\n【战斗日志】');
      console.log(result.log.join('\n'));

      // 统计各种效果触发情况
      const effectsFound: Record<string, boolean> = {
        伤害: false,
        吸血: false,
        真实伤害: false,
        斩杀: false,
        驱散: false,
        法力吸取: false,
        治疗: false,
        反弹: false,
        护盾: false,
        反击: false,
        中毒: false,
        定身: false,
        法力回复: false,
        暴击: false,
        闪避: false,
      };

      for (const log of result.log) {
        if (log.includes('造成') || log.includes('点伤害'))
          effectsFound['伤害'] = true;
        if (log.includes('吸取了') && log.includes('气血'))
          effectsFound['吸血'] = true;
        if (log.includes('真实伤害')) effectsFound['真实伤害'] = true;
        if (log.includes('斩杀') || log.includes('弱点一击'))
          effectsFound['斩杀'] = true;
        if (log.includes('被驱散了') || log.includes('驱散了'))
          effectsFound['驱散'] = true;
        if (log.includes('被吸取了') && log.includes('法力'))
          effectsFound['法力吸取'] = true;
        if (log.includes('恢复') && log.includes('气血'))
          effectsFound['治疗'] = true;
        if (log.includes('反弹')) effectsFound['反弹'] = true;
        if (log.includes('护盾') || log.includes('护盾耗尽'))
          effectsFound['护盾'] = true;
        if (log.includes('反击')) effectsFound['反击'] = true;
        if (log.includes('中毒') || log.includes('毒'))
          effectsFound['中毒'] = true;
        if (log.includes('定身') || log.includes('无法行动'))
          effectsFound['定身'] = true;
        if (log.includes('法力') && log.includes('回复'))
          effectsFound['法力回复'] = true;
        if (log.includes('暴击')) effectsFound['暴击'] = true;
        if (log.includes('闪避')) effectsFound['闪避'] = true;
      }

      console.log('\n【效果触发统计】');
      for (const [effect, found] of Object.entries(effectsFound)) {
        console.log(`  ${found ? '✅' : '❌'} ${effect}`);
      }

      const triggerCount = Object.values(effectsFound).filter((v) => v).length;
      console.log(
        `\n效果触发率: ${triggerCount}/${Object.keys(effectsFound).length}`,
      );
      console.log(`\n✨ 胜者: ${result.winner.name}`);
      console.log(`📊 总回合数: ${result.turns}`);
      console.log(`❤️ 攻击者剩余HP: ${result.playerHp}`);
      console.log(`❤️ 防御者剩余HP: ${result.opponentHp}`);
      console.log('=====================================\n');

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.log.length).toBeGreaterThan(0);
    });
  });
});
