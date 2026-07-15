import { EventBus } from '../../core/EventBus';
import type { DamageRequestEvent } from '../../core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { ReflectEffect } from '../../effects/ReflectEffect';
import type { DamageTakenEvent } from '../../core/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        defenseScale: args.defenseScale * (1 - bypass),
      },
      ...(bypass > 0
        ? [{
            kind: 'bypass',
            amount: args.amount * bypass,
            mitigation: 'bypass_defense' as const,
            defenseScale: 0,
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
