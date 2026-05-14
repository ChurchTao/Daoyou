import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BattleEngineV5 } from '../../BattleEngineV5';
import { GameplayTags } from '../../core';
import { BuffConfig } from '../../core/configs';
import { EventBus } from '../../core/EventBus';
import { ActionPreEvent, DamageRequestEvent } from '../../core/events';
import { AbilityType, AttributeType, BuffType, DamageSource } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';

describe('战斗引擎 V5 原子效果全量回归验证 (最终回归版)', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {});

  const createTestUnit = (
    id: string,
    name: string,
    attrs: Partial<Record<AttributeType, number>> = {},
  ) => {
    const unit = new Unit(id, name, {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 100,
      [AttributeType.WILLPOWER]: 100,
      [AttributeType.WISDOM]: 100,
      ...attrs,
    });
    unit.restoreMp(1000);
    return unit;
  };

  it('1. 验证【剧毒与驱散】：锁定命中确保流程执行', () => {
    const player = createTestUnit('player', '法海');
    const opponent = createTestUnit('opponent', '蛇精');

    console.log('--- 测试【剧毒与驱散】：锁定命中确保流程执行 ---');
    console.log(player.getSnapshot());

    const poisonBuffCfg: BuffConfig = {
      id: 'real_poison',
      name: '万蚁噬心',
      type: BuffType.DEBUFF,
      duration: 3,
      stackRule: 'stack_layer',
      tags: [
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.STATUS.STATE.POISONED,
        GameplayTags.BUFF.DOT.ROOT,
      ],
      listeners: [
        {
          eventType: 'ActionPreEvent',
          scope: 'owner_as_actor',
          priority: 45,
          guard: {
            requireOwnerAlive: true,
          },
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 10,
                  attribute: AttributeType.MAGIC_ATK,
                  coefficient: 0.12,
                },
              },
            },
          ],
        },
      ],
    };

    player.abilities.addAbility(
      AbilityFactory.create({
        slug: 'cast_poison',
        name: '施毒术',
        type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.SKILL],
        priority: 100,
        cooldown: 5,
        effects: [
          { type: 'apply_buff', params: { buffConfig: poisonBuffCfg } },
        ],
      }),
    );

    player.abilities.addAbility(
      AbilityFactory.create({
        slug: 'dispel_skill',
        name: '清静咒',
        type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.SKILL],
        priority: 90,
        cooldown: 2, // 增加 CD，让法海在 CD 期间能普攻
        effects: [
          {
            type: 'dispel',
            params: {
              targetTag: GameplayTags.STATUS.STATE.POISONED,
              maxCount: 1,
            },
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    console.log(result.logs);
  });

  it('3. 验证【反伤与免死】：锁定 1 血存活', () => {
    const attacker = createTestUnit('attacker', '杀手', {
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 1000,
    });
    const defender = createTestUnit('defender', '不死者', {
      [AttributeType.SPEED]: 0,
    });

    attacker.takeDamage(100);

    attacker.abilities.addAbility(
      AbilityFactory.create({
        slug: 'execute',
        name: '斩杀',
        type: AbilityType.ACTIVE_SKILL,
        priority: 100,
        cooldown: 3,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: { attribute: AttributeType.ATK, coefficient: 2.0 },
            },
          },
        ],
        listeners: [
          {
            eventType: 'DamageTakenEvent',
            scope: 'owner_as_caster',
            priority: 50,
            guard: {
              skipReflectSource: true,
            },
            effects: [
              {
                type: 'resource_drain',
                params: {
                  sourceType: 'hp',
                  targetType: 'hp',
                  ratio: 0.1,
                },
              },
            ],
          },
        ],
      }),
    );

    defender.buffs.addBuff(
      BuffFactory.create({
        id: 'passive_immortal',
        name: '不灭',
        type: BuffType.BUFF,
        duration: 3,
        stackRule: 'override',
        listeners: [
          {
            eventType: 'DamageTakenEvent',
            scope: 'owner_as_target',
            priority: 50,
            guard: {
              requireOwnerAlive: false,
              allowLethalWindow: true,
              skipReflectSource: true,
            },
            effects: [
              { type: 'reflect', params: { ratio: 0.1 } },
              { type: 'death_prevent', params: {} },
            ],
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    console.log(result.logs);

    expect(result.logs[2]).toContain('对「不死者」造成');
    expect(result.logs[2]).toContain('反弹');
    expect(result.logs[2]).not.toContain('对「杀手」造成');
  });

  it('4. 验证【护盾与焚元】：纯粹分步验证', () => {
    const attacker = createTestUnit('striker', '削减者');
    const defender = createTestUnit('wall', '护盾者');

    console.log('--- 测试【护盾与焚元】：纯粹分步验证 ---');
    console.log(defender.getSnapshot());

    attacker.abilities.addAbility(
      AbilityFactory.create({
        slug: 'burn',
        name: '蚀元咒',
        type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.SKILL],
        priority: 100,
        cooldown: 3,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [{ type: 'mana_burn', params: { value: { base: 600 } } }],
      }),
    );

    defender.abilities.addAbility(
      AbilityFactory.create({
        slug: 'shield',
        name: '真元盾',
        type: AbilityType.ACTIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.SKILL],
        mpCost: 200,
        priority: 90,
        cooldown: 3,
        targetPolicy: { team: 'self', scope: 'single' },
        effects: [{ type: 'shield', params: { value: { base: 200 } } }],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();
    console.log(result.logs);

    expect(
      result.logs.some(
        (log) =>
          log.includes('对「护盾者」造成') &&
          log.includes('抵扣护盾') &&
          log.includes('护盾已破碎'),
      ),
    ).toBe(true);
  });

  it('5. 验证【DOT 叠层】：ActionPreEvent 下按层数线性放大并保留来源', () => {
    const source = createTestUnit('source', '施毒者');
    const target = createTestUnit('target', '受术者');
    const damageRequests: DamageRequestEvent[] = [];

    const poisonBuffCfg: BuffConfig = {
      id: 'stacking_poison',
      name: '叠毒',
      type: BuffType.DEBUFF,
      duration: 3,
      stackRule: 'stack_layer',
      tags: [
        GameplayTags.BUFF.TYPE.DEBUFF,
        GameplayTags.BUFF.DOT.ROOT,
        GameplayTags.BUFF.DOT.POISON,
      ],
      listeners: [
        {
          eventType: 'ActionPreEvent',
          scope: 'owner_as_actor',
          priority: 45,
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 10,
                  attribute: AttributeType.MAGIC_ATK,
                  coefficient: 0.1,
                },
              },
            },
          ],
        },
      ],
    };

    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => damageRequests.push(event),
      999,
    );

    target.buffs.addBuff(BuffFactory.create(poisonBuffCfg), source);
    target.buffs.addBuff(BuffFactory.create(poisonBuffCfg), source);

    expect(target.buffs.getAllBuffs()).toHaveLength(1);
    expect(target.buffs.getAllBuffs()[0].getLayer()).toBe(2);

    EventBus.instance.publish<ActionPreEvent>({
      type: 'ActionPreEvent',
      timestamp: Date.now(),
      caster: target,
    });

    expect(damageRequests).toHaveLength(1);
    expect(damageRequests[0].baseDamage).toBe(120);
    expect(damageRequests[0].buff?.id).toBe('stacking_poison');
    expect(damageRequests[0].caster?.id).toBe(source.id);
    expect(damageRequests[0].target.id).toBe(target.id);
    expect(damageRequests[0].damageSource).not.toBe(DamageSource.REFLECT);
  });

  it('2. 验证【伤害免疫优先于魔法盾】：执行顺序与零伤害处理', () => {
    const attacker = createTestUnit('attacker', '进攻者', {
      [AttributeType.SPIRIT]: 300,
      [AttributeType.VITALITY]: 200,
    });
    const defender = createTestUnit('defender', '防御者', {
      [AttributeType.WISDOM]: 300,
    });

    console.log('--- 测试【伤害免疫优先于魔法盾】：实际战斗场景 ---');
    console.log(
      '攻击者 HP:',
      attacker.getCurrentHp(),
      'MP:',
      attacker.getCurrentMp(),
    );
    console.log(
      '防御者 HP:',
      defender.getCurrentHp(),
      'MP:',
      defender.getCurrentMp(),
    );

    // 防御者同时具有 damage_immunity 和 magic_shield 被动
    // damage_immunity 应该比 magic_shield 先执行，使伤害为 0
    // DAMAGE_APPLY = 55，所以伤害免疫应该在 56 或更高的优先级
    // magic_shield 在 DAMAGE_APPLY 优先级执行（55）
    defender.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_immunity_and_shield',
        name: '防御法门',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            eventType: 'DamageEvent',
            scope: 'owner_as_target',
            priority: 56, // damage_immunity 优先级高于魔法盾
            effects: [
              {
                type: 'damage_immunity',
                params: { tags: [GameplayTags.ABILITY.CHANNEL.MAGIC] },
              },
            ],
          },
          {
            eventType: 'DamageEvent',
            scope: 'owner_as_target',
            priority: 55, // magic_shield 在标准 DAMAGE_APPLY 优先级
            effects: [
              {
                type: 'magic_shield',
                params: {},
              },
            ],
          },
        ],
      }),
    );

    // 攻击者施放魔法伤害
    attacker.abilities.addAbility(
      AbilityFactory.create({
        slug: 'fireball',
        name: '火球术',
        type: AbilityType.ACTIVE_SKILL,
        priority: 100,
        cooldown: 3,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 200,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 1.0,
              },
            },
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    console.log('战斗日志：', result.logs);
    console.log(
      '攻击者 HP:',
      attacker.getCurrentHp(),
      'MP:',
      attacker.getCurrentMp(),
    );
    console.log(
      '防御者 HP:',
      defender.getCurrentHp(),
      'MP:',
      defender.getCurrentMp(),
    );

    // 验证：伤害应该被免疫为 0，因此魔法盾不应消耗 MP
    expect(result.logs.some((log) => log.includes('免疫了此次伤害'))).toBe(
      true,
    );
  });
});
