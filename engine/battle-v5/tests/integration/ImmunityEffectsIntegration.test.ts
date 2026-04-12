import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { EffectConfig } from '../../core/configs';
import { DamageEvent, DamageImmuneEvent, EventPriorityLevel, ManaShieldAbsorbEvent } from '../../core/events';
import { AbilityType, AttributeType, BuffType, DamageType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';

describe('免疫效果集成测试', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  function createUnit(id: string, name: string): Unit {
    return new Unit(id, name, {
      [AttributeType.SPIRIT]: 300,
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 100,
      [AttributeType.WILLPOWER]: 200,
      [AttributeType.WISDOM]: 300,
    });
  }

  function addPassiveDamageListener(unit: Unit, effects: Array<EffectConfig>): void {
    unit.abilities.addAbility(
      AbilityFactory.create({
        slug: `passive_${effects.map((effect) => effect.type).join('_')}`,
        name: '护体法门',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            eventType: 'DamageEvent',
            scope: 'owner_as_target',
            priority: EventPriorityLevel.DAMAGE_APPLY,
            effects,
          },
        ],
      }),
    );
  }

  it('魔法盾应消耗 MP 并吸收 98% 伤害', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '护盾者');
    addPassiveDamageListener(defender, [{ type: 'magic_shield', params: {} }]);

    let absorbEvent: ManaShieldAbsorbEvent | undefined;
    const handler = (event: ManaShieldAbsorbEvent) => {
      absorbEvent = event;
    };
    EventBus.instance.subscribe<ManaShieldAbsorbEvent>('ManaShieldAbsorbEvent', handler, EventPriorityLevel.COMBAT_LOG);

    const beforeMp = defender.getCurrentMp();
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageType: DamageType.MAGICAL,
      finalDamage: 100,
    };

    EventBus.instance.publish(damageEvent);

    expect(damageEvent.finalDamage).toBe(2);
    expect(defender.getCurrentMp()).toBe(beforeMp - 98);
    expect(absorbEvent).toMatchObject({
      absorbedDamage: 98,
      mpConsumed: 98,
      remainDamage: 2,
    });

    EventBus.instance.unsubscribe<ManaShieldAbsorbEvent>('ManaShieldAbsorbEvent', handler);
  });

  it('魔法盾在 MP 不足时应部分吸收伤害', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '护盾者');
    addPassiveDamageListener(defender, [{ type: 'magic_shield', params: {} }]);

    defender.takeMp(defender.getCurrentMp() - 30);

    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageType: DamageType.MAGICAL,
      finalDamage: 100,
    };

    EventBus.instance.publish(damageEvent);

    expect(damageEvent.finalDamage).toBe(70);
    expect(defender.getCurrentMp()).toBe(0);
  });

  it('伤害免疫应拦截命中技能标签的伤害', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '免疫者');
    addPassiveDamageListener(defender, [
      {
        type: 'damage_immunity',
        params: { tags: [GameplayTags.ABILITY.CHANNEL.MAGIC] },
      },
    ]);

    const ability = AbilityFactory.create({
      slug: 'magic_hit',
      name: '玄火咒',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.CHANNEL.MAGIC],
      effects: [],
    });

    let blockedDamage = -1;
    const handler = (event: { blockedDamage: number }) => {
      blockedDamage = event.blockedDamage;
    };
    EventBus.instance.subscribe<DamageImmuneEvent>('DamageImmuneEvent', handler, EventPriorityLevel.COMBAT_LOG);

    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability,
      damageType: DamageType.MAGICAL,
      finalDamage: 120,
    };

    EventBus.instance.publish(damageEvent);

    expect(damageEvent.finalDamage).toBe(0);
    expect(blockedDamage).toBe(120);

    EventBus.instance.unsubscribe<DamageImmuneEvent>('DamageImmuneEvent', handler);
  });

  it('伤害免疫应能消费直接声明的能力标签', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '免疫者');
    const projectedTags = [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ];

    addPassiveDamageListener(defender, [
      {
        type: 'damage_immunity',
        params: { tags: [GameplayTags.ABILITY.CHANNEL.MAGIC] },
      },
    ]);

    const ability = AbilityFactory.create({
      slug: 'projected_magic_hit',
      name: '投影玄火咒',
      type: AbilityType.ACTIVE_SKILL,
      tags: projectedTags,
      effects: [],
    });

    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability,
      damageType: DamageType.MAGICAL,
      finalDamage: 120,
    };

    EventBus.instance.publish(damageEvent);

    expect(damageEvent.finalDamage).toBe(0);
  });

  it('伤害免疫应拦截命中来源 Buff 标签的伤害', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '免疫者');
    addPassiveDamageListener(defender, [
      {
        type: 'damage_immunity',
        params: { tags: [GameplayTags.BUFF.DOT.ROOT] },
      },
    ]);

    const sourceBuff = BuffFactory.create({
      id: 'burn_dot',
      name: '灼烧',
      type: BuffType.DEBUFF,
      duration: 2,
      stackRule: 'refresh_duration',
      tags: [GameplayTags.BUFF.DOT.ROOT, GameplayTags.BUFF.DOT.BURN],
    });

    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      buff: sourceBuff,
      damageType: DamageType.DOT,
      finalDamage: 88,
    };

    EventBus.instance.publish(damageEvent);

    expect(damageEvent.finalDamage).toBe(0);
  });
});