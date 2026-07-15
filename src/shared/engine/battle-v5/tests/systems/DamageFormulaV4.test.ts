import { EventBus } from '../../core/EventBus';
import type { DamageRequestEvent } from '../../core/events';
import {
  AbilityType,
  AttributeType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { rememberAmount } from '../../core/runtimeState';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { ReflectEffect } from '../../effects/ReflectEffect';
import { ValueCalculator } from '../../core/ValueCalculator';
import type { DamageTakenEvent } from '../../core/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameplayTags } from '@shared/engine/shared/tag-domain';

function unit(id: string): Unit {
  return new Unit(id, id, {});
}

function fixed(unit: Unit, attrType: AttributeType, value: number): void {
  unit.attributes.addModifier({
    id: `${unit.id}.${attrType}`,
    attrType,
    type: ModifierType.OVERRIDE,
    value,
    source: 'test',
  });
  unit.updateDerivedStats();
}

function request(args: {
  caster: Unit;
  target: Unit;
  amount: number;
  defenseScale: number;
  damageType?: DamageType;
  damageSource?: DamageSource;
  bypass?: number;
  forceCritical?: boolean;
}): DamageRequestEvent {
  const bypass = args.bypass ?? 0;
  return {
    type: 'DamageRequestEvent',
    timestamp: Date.now(),
    caster: args.caster,
    target: args.target,
    damageSource: args.damageSource ?? DamageSource.DIRECT,
    damageType: args.damageType ?? DamageType.PHYSICAL,
    baseDamage: args.amount,
    finalDamage: args.amount,
    forceCritical: args.forceCritical,
    damageComponents: [
      {
        kind: 'normal',
        amount: args.amount * (1 - bypass),
        mitigation: 'normal',
        attackBase: args.amount / args.defenseScale,
        segmentMultiplier: args.defenseScale * (1 - bypass),
      },
      ...(bypass > 0
        ? [{
            kind: 'bypass',
            amount: args.amount * bypass,
            mitigation: 'bypass_defense' as const,
          }]
        : []),
    ],
  };
}

describe('V4攻防差后乘倍率', () => {
  let system: DamageSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    system = new DamageSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    system.destroy();
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it.each([
    [DamageType.PHYSICAL, AttributeType.DEF],
    [DamageType.MAGICAL, AttributeType.MAGIC_DEF],
  ] as const)('按攻击基数减%s防御后乘段倍率', (damageType, defenseAttr) => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, defenseAttr, 100);
    const event = request({ caster, target, amount: 100, defenseScale: 0.5, damageType });
    EventBus.instance.publish(event);
    expect(event.finalDamage).toBe(50);
  });

  it('相同总倍率的单段与多段不会因重复扣除整段防御而失真', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 100);
    const single = request({ caster, target, amount: 200, defenseScale: 1 });
    EventBus.instance.publish(single);
    const first = request({ caster, target, amount: 100, defenseScale: 0.5 });
    const second = request({ caster, target, amount: 100, defenseScale: 0.5 });
    EventBus.instance.publish(first);
    EventBus.instance.publish(second);
    expect(first.finalDamage + second.finalDamage).toBe(single.finalDamage);
  });

  it('穿透限制后的有效防御按段倍率结算', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(caster, AttributeType.ARMOR_PENETRATION, 0.5);
    fixed(target, AttributeType.DEF, 100);
    const event = request({ caster, target, amount: 100, defenseScale: 0.5 });
    EventBus.instance.publish(event);
    expect(event.finalDamage).toBe(75);
  });

  it('混合穿防只对普通分量扣防', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 100);
    const event = request({ caster, target, amount: 200, defenseScale: 1, bypass: 0.2 });
    EventBus.instance.publish(event);
    expect(event.finalDamage).toBe(120);
  });

  it('固定值与属性合并为明确攻击基数和段倍率', () => {
    const caster = unit('caster');
    fixed(caster, AttributeType.ATK, 100);
    const result = ValueCalculator.calculateDetailed(
      { base: 20, attribute: AttributeType.ATK, coefficient: 0.5 },
      caster,
    );
    expect(result.total).toBe(70);
    expect(result.components).toEqual([{
      kind: `attribute:${AttributeType.ATK}`,
      amount: 70,
      mitigation: 'normal',
      attackBase: 140,
      segmentMultiplier: 0.5,
    }]);
  });

  it('零属性倍率的固定值按纯固定伤害段处理', () => {
    const caster = unit('caster');
    const result = ValueCalculator.calculateDetailed(
      { base: 80, attribute: AttributeType.ATK, coefficient: 0 },
      caster,
    );
    expect(result.components).toEqual([{
      kind: 'base',
      amount: 80,
      mitigation: 'normal',
      attackBase: 80,
      segmentMultiplier: 1,
    }]);
  });

  it('记忆追加伤害并入所属伤害段攻击基数而非隐性免防', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(caster, AttributeType.ATK, 100);
    fixed(target, AttributeType.DEF, 50);
    rememberAmount(caster, 'test.memory', 100);
    const ability = AbilityFactory.create({
      slug: 'test.memory-strike',
      name: '记忆一击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.ATK, coefficient: 0.5 },
        },
      }],
    });
    AbilityFactory.createEffect({
      type: 'ability_transform',
      params: {
        id: 'test.memory-transform',
        bonusDamageMemory: { key: 'test.memory', ratio: 1 },
      },
    })?.execute({ caster, target: caster });
    let requestEvent: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.ability?.id === ability.id) requestEvent = event;
      },
      -1_000,
    );

    ability.execute({ caster, target });

    expect(requestEvent?.damageComponents).toEqual([
      expect.objectContaining({
        attackBase: 300,
        segmentMultiplier: 0.5,
      }),
    ]);
    expect(requestEvent?.finalDamage).toBe(125);
  });

  it('反击正常扣防且强制暴击应用施法者暴击倍率', () => {
    const caster = unit('caster');
    const target = unit('target');
    fixed(target, AttributeType.DEF, 50);
    fixed(caster, AttributeType.CRIT_DAMAGE_MULT, 2);
    const expectedMultiplier = caster.attributes.getValue(AttributeType.CRIT_DAMAGE_MULT);
    const event = request({
      caster,
      target,
      amount: 100,
      defenseScale: 1,
      damageSource: DamageSource.COUNTER,
      forceCritical: true,
    });
    EventBus.instance.publish(event);
    expect(event.isCritical).toBe(true);
    expect(event.critMultiplier).toBe(expectedMultiplier);
    expect(event.finalDamage).toBe(Math.round(50 * expectedMultiplier));
  });

  it('直接伤害全部被护盾吸收时仍计为本行动已造成直接伤害', () => {
    const caster = unit('caster');
    const target = unit('target');
    caster.combatResources.define({
      id: 'test.momentum',
      name: '剑势',
      initial: 3,
      max: 6,
      decayOnNoDirectDamage: 1,
    });
    target.setShield(10_000);
    const hpBefore = target.getCurrentHp();
    caster.combatResources.beginAction();
    EventBus.instance.publish(
      request({ caster, target, amount: 100, defenseScale: 1 }),
    );
    caster.combatResources.finishAction(false, false);

    expect(target.getCurrentHp()).toBe(hpBefore);
    expect(target.getCurrentShield()).toBeLessThan(10_000);
    expect(caster.combatResources.getCurrent('test.momentum')).toBe(3);
  });

  it.each([DamageSource.REFLECT, DamageSource.COUNTER, DamageSource.FOLLOW_UP])(
    '二次伤害来源%s不会递归触发反伤',
    (damageSource) => {
      const caster = unit('caster');
      const target = unit('target');
      let reflected = 0;
      EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
        if (event.damageSource === DamageSource.REFLECT) reflected += 1;
      });
      const triggerEvent: DamageTakenEvent = {
        type: 'DamageTakenEvent',
        timestamp: Date.now(),
        caster,
        target,
        damageSource,
        damageTaken: 100,
        beforeHp: 200,
        remainHp: 100,
        isLethal: false,
      };
      new ReflectEffect({ ratio: 0.5 }).execute({
        caster: target,
        target,
        triggerEvent,
      });
      expect(reflected).toBe(0);
    },
  );
});
